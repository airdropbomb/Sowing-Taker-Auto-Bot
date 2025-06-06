import { HttpsProxyAgent } from "https-proxy-agent";
import fs from "fs/promises";
import fetch from "node-fetch";
import { ethers } from "ethers";
import readline from 'readline/promises';
import { TurnstileTask } from 'node-capmonster';
import { Solver } from "@2captcha/captcha-solver";
import bestcaptchasolver from 'bestcaptchasolver';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("1. CapResolve (recommended because it’s the cheapest) - 2. 2Captcha - 3. Capmonster - 4. Bestcaptchasolver");
const type = await rl.question("Enter the type of captcha solving service: ");
const apiKey = await rl.question("Enter your API key: ");

const pageurl = "https://sowing.taker.xyz/";
const sitekey = "0x4AAAAAABNqF8H4KF9TDs2O"
const CONTRACT_ADDRESS = "0xF929AB815E8BfB84Cdab8d1bb53F22eB1e455378";
const API_BASE_URL = 'https://sowing-api.taker.xyz';
const CONTRACT_ABI = [
  {
    constant: false,
    inputs: [],
    name: "active",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function solverCaptcha() {
  if (type === "1") {
    const Solver = (await import("capsolver-npm")).Solver;
    const solver = new Solver({
      apiKey,
    });
    try {
      const token = await solver.turnstileproxyless({
        websiteURL: pageurl,
        websiteKey: sitekey,
      });
      console.log("Captcha solved successfully");
      return token.token
    } catch (error) {
      console.log("CapResolve Error: ", error.message);
    }
  }

  if (type === "2") {
    console.log("Solving captcha with 2Captcha");
    const solver = new Solver(apiKey);
    const result = (await solver.cloudflareTurnstile({ pageurl, sitekey })).data;
    console.log("Captcha solved successfully");
    return result;
  }
  if (type === "3") {
    console.log("Solving captcha with Capmonster");
    const capMonster = new TurnstileTask(apiKey);
    const task = capMonster.task({
        websiteKey: sitekey,
        websiteURL: pageurl
    });
    const taskId = await capMonster.createWithTask(task)
    const result = await capMonster.joinTaskResult(taskId)
    console.log("Captcha solved successfully");
    return result.token
  }
  if (type === "4") {
    bestcaptchasolver.set_access_token(apiKey);
    try {
      const id = await bestcaptchasolver.submit_turnstile({
        page_url: pageurl,
        site_key: sitekey,
      })
      const token = await bestcaptchasolver.retrieve_captcha(id);
      console.log("Captcha solved successfully");
      return token.solution
    } catch (error) {
      console.log("Bestcaptchasolver Error: ", error.message);
    }
  }
}

async function pointInfo(token, agent) {
  const request = await fetch("https://sowing-api.taker.xyz/user/pointInfo", {
    "headers": {
      "accept": "application/json, text/plain, */*",
      "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
      "authorization": `Bearer ${token}`,
      "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "https://sowing.taker.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET",
    agent
  });
  const response = await request.json()
  console.log(`Points after claiming:`, response.result);
}

async function login(address, privateKey, agent, invitationCode) {
  try {
    const req = await fetch(
      "https://sowing-api.taker.xyz/wallet/generateNonce",
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language":
            "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
          "content-type": "application/json",
          "sec-ch-ua":
            '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          Referer: "https://sowing.taker.xyz/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: JSON.stringify({
          walletAddress: address
        }),
        method: "POST",
        agent,
      }
    );

    const nonce = (await req.json()).result.nonce;
    if (nonce) {
      const signature = await new ethers.Wallet(privateKey).signMessage(nonce);
      const getNonce = nonce.split('\n')[4].replace("Nonce: ", "");
      const message = `Taker quest needs to verify your identity to prevent unauthorized access. Please confirm your sign-in details below:\n\naddress: ${address}\n\nNonce: ${getNonce}`
      const requestLogin = await fetch(
        "https://sowing-api.taker.xyz/wallet/login",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "accept-language":
              "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/json",
            "sec-ch-ua":
              '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            Referer: "https://sowing.taker.xyz/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: JSON.stringify({
            address,
            signature,
            message,
            invitationCode,
          }),
          method: "POST",
          agent,
        }
      );
      const token = (await requestLogin.json()).result.token;
      console.log(`Login successful, token for wallet ${address} is:`, token);
      return token;
    }
  } catch (error) {
    console.log(`Login error`, error);
  }
}

async function claimOnchain(privateKey, token, agent) {
  const turnstile = await solverCaptcha()
  await fetch("https://sowing-api.taker.xyz/task/signIn?status=true", {
    "headers": {
      "accept": "application/json, text/plain, */*",
      "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
      "authorization": `Bearer ${token.trim()}`,
      "cf-turnstile-token": turnstile,
      "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "https://sowing.taker.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  });
  

  const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc-mainnet.taker.xyz",
    { chainId: 1125 }
  );
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  try {
    const tx = await contract.active({ type: 2 });
    await tx.wait();
  } catch (e) {
    if (e.code === "UNPREDICTABLE_GAS_LIMIT") {
      console.log(`Not enough gas fee, but still checked in 😏`.yellow);
      await fetch(`${API_BASE_URL}/task/signIn?status=true`, {
          headers: {
            accept: "application/json, text/plain, */*",
            "accept-language":
              "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/json",
            "sec-ch-ua":
              '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            Referer: "https://sowing.taker.xyz/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Authorization": `Bearer ${token.trim()}`,
          },
          agent,
          method: "GET"
      })
      console.log(
        `Successfully called check-in again after gas error`.green
      );
    } else {
      throw e;
    }
  }
}

async function main() {
  const invitationCode = "1Z2BT73G";
  console.log(`
       █████╗ ██████╗ ██████╗     ███╗   ██╗ ██████╗ ██████╗ ███████╗
      ██╔══██╗██╔══██╗██╔══██╗    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
      ███████║██║  ██║██████╔╝    ██╔██╗ ██║██║   ██║██║  ██║█████╗  
      ██╔══██║██║  ██║██╔══██╗    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
      ██║  ██║██████╔╝██████╔╝    ██║ ╚████║╚██████╔╝██████╔╝███████╗
      ╚═╝  ╚═╝╚═════╝ ╚═════╝     ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝
  `);
  console.log("TOOL DEVELOPED BY: ADB NODE");
  console.log(
    "Join My Channel - https://t.me/airdropbombnode"
  );
  console.log("------------------------------------------------------------");
  while (true) {
    try {
      const proxyStr = await fs.readFile("proxies.txt", "utf-8");
      const proxies = proxyStr
        .trim()
        .split("\n")
        .map((a) => a.trim());
      const walletStr = await fs.readFile("wallets.txt", "utf-8");
      const wallets = walletStr
        .trim()
        .split("\n")
        .map((a) => a.trim());

      console.log(wallets);

      await Promise.all(
        wallets.map(async (wallet, i) => {
          let [address, privateKey] = wallet.split(",");
          privateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
          const agent = proxies?.[i] ? new HttpsProxyAgent(proxies[i]) : null;
          const token = await login(address, privateKey, agent, invitationCode);
          await claimOnchain(privateKey, token, agent);
          await pointInfo(token, agent)
        })
      );
    } catch (error) {
      console.log(error);
    }
    console.log("Wait 3 hours to continue");
    await new Promise((resolve) => setTimeout(resolve, 3 * 60 * 60 * 1000));
  }
}

main();
