import { TonClient } from "@tonclient/core";
import { Account } from "@tonclient/appkit";
import { deploy, callThroughMultisig } from "@tonclient/appkit";
import { toNano, encodeMessage, deployWithGiver, expect } from "./utils";
import { Task4 } from "../contracts";

describe("Task4", () => {
  let client: TonClient;
  let owner: Account;
  let task4: Task4;

  before(async () => {
    client = new TonClient({ network: { server_address: "http://localhost" } });
  });

  it("deploys Task4 contract", async () => {
    const code = await client.boc.get_code_from_tvc({ tvc: Task4.tvc });

    owner = await Account.with({
      client,
      signer: { type: "None" },
      balance: toNano(1),
    });

    task4 = await deployWithGiver(owner, Task4, { code });
  });

  it("locks and withdraws NFT", async () => {
    const newOwner = await Account.with({
      client,
      signer: { type: "None" },
    });
    const lockTime = 3600; // Lock for 1 hour

    // Lock NFT
    const lockResult = await callThroughMultisig(owner, task4.methods.lockNFT(newOwner.address, lockTime), {
      abi: Task4.abi,
    });
    expect(lockResult.decoded?.time).to.equal(lockTime);

    // Try to withdraw NFT before lock time expires
    try {
      await callThroughMultisig(newOwner, task4.methods.withdrawNFT(), { abi: Task4.abi });
    } catch (error) {
      expect(error.error).to.equal("NFT is still locked");
    }

    // Wait for lock time to expire
    await new Promise((resolve) => setTimeout(resolve, lockTime * 1000));

    // Withdraw NFT
    await callThroughMultisig(newOwner, task4.methods.withdrawNFT(), { abi: Task4.abi });
    expect(await newOwner.getAddress()).to.equal(await task4.call({ method: "owner" }));
  });
});
