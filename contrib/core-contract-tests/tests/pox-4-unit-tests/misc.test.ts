import { beforeEach, describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";
import { Pox4SignatureTopic, poxAddressToTuple } from "@stacks/stacking";
import {
  ERRORS,
  POX_CONTRACT,
  StackerInfo,
  allowContractCaller,
  getStackingMinimum,
  stackStx,
  stackers,
} from "./helpers";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;

beforeEach(() => {
  simnet.setEpoch("3.0");
});

describe("test `set-burnchain-parameters`", () => {
  it("sets the parameters correctly", () => {
    const response = simnet.callPublicFn(
      POX_CONTRACT,
      "set-burnchain-parameters",
      [Cl.uint(100), Cl.uint(5), Cl.uint(20), Cl.uint(6)],
      address1
    );
    expect(response.result).toBeOk(Cl.bool(true));

    const fbbh = simnet.getDataVar(
      POX_CONTRACT,
      "first-burnchain-block-height"
    );
    expect(fbbh).toBeUint(100);

    const ppcl = simnet.getDataVar(POX_CONTRACT, "pox-prepare-cycle-length");
    expect(ppcl).toBeUint(5);

    const prcl = simnet.getDataVar(POX_CONTRACT, "pox-reward-cycle-length");
    expect(prcl).toBeUint(20);

    const configured = simnet.getDataVar(POX_CONTRACT, "configured");
    expect(configured).toBeBool(true);
  });

  it("cannot be called twice", () => {
    simnet.callPublicFn(
      POX_CONTRACT,
      "set-burnchain-parameters",
      [Cl.uint(100), Cl.uint(5), Cl.uint(20), Cl.uint(6)],
      address1
    );
    const response = simnet.callPublicFn(
      POX_CONTRACT,
      "set-burnchain-parameters",
      [Cl.uint(101), Cl.uint(6), Cl.uint(21), Cl.uint(7)],
      address1
    );
    expect(response.result).toBeErr(Cl.int(ERRORS.ERR_NOT_ALLOWED));
  });
});

describe("test `burn-height-to-reward-cycle`", () => {
  it("returns the correct reward cycle", () => {
    let response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(1)],
      address1
    );
    expect(response.result).toBeUint(0);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(2099)],
      address1
    );
    expect(response.result).toBeUint(1);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(2100)],
      address1
    );
    expect(response.result).toBeUint(2);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(2101)],
      address1
    );
    expect(response.result).toBeUint(2);
  });

  it("returns the correct reward cycle with modified configuration", () => {
    simnet.callPublicFn(
      POX_CONTRACT,
      "set-burnchain-parameters",
      [Cl.uint(100), Cl.uint(5), Cl.uint(20), Cl.uint(6)],
      address1
    );

    expect(() =>
      simnet.callReadOnlyFn(
        POX_CONTRACT,
        "burn-height-to-reward-cycle",
        [Cl.uint(1)],
        address1
      )
    ).toThrowError();

    expect(() =>
      simnet.callReadOnlyFn(
        POX_CONTRACT,
        "burn-height-to-reward-cycle",
        [Cl.uint(99)],
        address1
      )
    ).toThrowError();

    let response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(100)],
      address1
    );
    expect(response.result).toBeUint(0);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(101)],
      address1
    );
    expect(response.result).toBeUint(0);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(119)],
      address1
    );
    expect(response.result).toBeUint(0);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(120)],
      address1
    );
    expect(response.result).toBeUint(1);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(121)],
      address1
    );
    expect(response.result).toBeUint(1);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "burn-height-to-reward-cycle",
      [Cl.uint(140)],
      address1
    );
    expect(response.result).toBeUint(2);
  });
});

describe("test `reward-cycle-to-burn-height`", () => {
  it("returns the correct burn height", () => {
    let response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "reward-cycle-to-burn-height",
      [Cl.uint(0)],
      address1
    );
    expect(response.result).toBeUint(0);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "reward-cycle-to-burn-height",
      [Cl.uint(1)],
      address1
    );
    expect(response.result).toBeUint(1050);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "reward-cycle-to-burn-height",
      [Cl.uint(2)],
      address1
    );
    expect(response.result).toBeUint(2100);

    expect(() =>
      simnet.callReadOnlyFn(
        POX_CONTRACT,
        "reward-cycle-to-burn-height",
        [Cl.uint(340282366920938463463374607431768211455n)],
        address1
      )
    ).toThrowError();
  });
});

describe("test `current-pox-reward-cycle`", () => {
  it("returns the correct reward cycle", () => {
    let response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "current-pox-reward-cycle",
      [],
      address1
    );
    expect(response.result).toBeUint(0);

    simnet.mineEmptyBlocks(2099);

    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "current-pox-reward-cycle",
      [],
      address1
    );
    expect(response.result).toBeUint(1);

    simnet.mineEmptyBlock();
    response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "current-pox-reward-cycle",
      [],
      address1
    );
    expect(response.result).toBeUint(2);
  });
});

describe("test `get-stacker-info`", () => {
  it("returns none when principal is not stacked", () => {
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-stacker-info",
      [Cl.principal(address1)],
      address1
    );
    expect(response.result).toBeNone();
  });

  it("returns info before stacked", () => {
    const stacker = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    let stackResponse = stackStx(
      stacker,
      amount,
      1000,
      6,
      amount,
      stacker.authId,
      address1
    );
    expect(stackResponse.result.type).toBe(ClarityType.ResponseOk);
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-stacker-info",
      [Cl.principal(stacker.stxAddress)],
      address1
    );
    expect(response.result).toBeSome(
      Cl.tuple({
        "delegated-to": Cl.none(),
        "first-reward-cycle": Cl.uint(1),
        "lock-period": Cl.uint(6),
        "pox-addr": poxAddressToTuple(stacker.btcAddr),
        "reward-set-indexes": Cl.list([
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
        ]),
      })
    );
  });

  it("returns info while stacked", () => {
    const stacker = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    let stackResponse = stackStx(
      stacker,
      amount,
      1000,
      6,
      amount,
      stacker.authId,
      address1
    );
    expect(stackResponse.result.type).toBe(ClarityType.ResponseOk);
    simnet.mineEmptyBlocks(2100);
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-stacker-info",
      [Cl.principal(stacker.stxAddress)],
      address1
    );
    expect(response.result).toBeSome(
      Cl.tuple({
        "delegated-to": Cl.none(),
        "first-reward-cycle": Cl.uint(1),
        "lock-period": Cl.uint(6),
        "pox-addr": poxAddressToTuple(stacker.btcAddr),
        "reward-set-indexes": Cl.list([
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(0),
        ]),
      })
    );
  });

  it("returns none after stacking expired", () => {
    const stacker = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    let stackResponse = stackStx(
      stacker,
      amount,
      1000,
      6,
      amount,
      stacker.authId,
      address1
    );
    expect(stackResponse.result.type).toBe(ClarityType.ResponseOk);
    simnet.mineEmptyBlocks(7350);
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-stacker-info",
      [Cl.principal(stacker.stxAddress)],
      address1
    );
    expect(response.result).toBeNone();
  });
});

describe("test `check-caller-allowed`", () => {
  it("returns true when called directly", () => {
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-caller-allowed",
      [],
      address1
    );
    expect(response.result).toBeBool(true);
  });

  it("returns false when called indirectly by unapproved caller", () => {
    const response = simnet.callReadOnlyFn(
      "indirect",
      "check-caller-allowed",
      [],
      address1
    );

    expect(response.result).toBeBool(false);
  });

  it("returns true when called indirectly by approved caller", () => {
    allowContractCaller(`${deployer}.indirect`, null, address1);
    const response = simnet.callReadOnlyFn(
      "indirect",
      "check-caller-allowed",
      [],
      address1
    );

    expect(response.result).toBeBool(true);
  });

  it("returns false when called indirectly by approved caller which has expired", () => {
    allowContractCaller(`${deployer}.indirect`, 10n, address1);

    let response = simnet.callReadOnlyFn(
      "indirect",
      "check-caller-allowed",
      [],
      address1
    );

    expect(response.result).toBeBool(true);

    // mine 11 blocks to expire the caller
    simnet.mineEmptyBlocks(11);

    response = simnet.callReadOnlyFn(
      "indirect",
      "check-caller-allowed",
      [],
      address1
    );

    expect(response.result).toBeBool(false);
  });
});

describe("test `get-reward-set-size`", () => {
  it("returns 0 when no stacking has occurred", () => {
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-size",
      [Cl.uint(0)],
      address1
    );
    expect(response.result).toBeUint(0);
  });

  it("returns number of stackers", () => {
    const amount = getStackingMinimum() * 1.2;

    stackers.forEach((stacker) => {
      const { result } = stackStx(
        stacker,
        amount,
        1000,
        6,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
    });

    const responseCycle1 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-size",
      [Cl.uint(1)],
      address1
    );
    expect(responseCycle1.result).toBeUint(3);

    const responseCycle7 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-size",
      [Cl.uint(7)],
      address1
    );
    expect(responseCycle7.result).toBeUint(0);
  });

  it("returns number of uniq pox address", () => {
    const amount = getStackingMinimum() * 1.2;

    stackers.forEach((_stacker) => {
      const stacker: StackerInfo = {
        ..._stacker,
        btcAddr: stackers[0].btcAddr,
      };
      const { result } = stackStx(
        stacker,
        amount,
        1000,
        6,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
    });

    const responseCycle1 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-size",
      [Cl.uint(1)],
      address1
    );
    expect(responseCycle1.result).toBeUint(3); // should it be 1?
  });
});

describe("test `get-total-ustx-stacked`", () => {
  it("returns 0 when no stacking has occurred", () => {
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(0)],
      address1
    );
    expect(response.result).toBeUint(0);
  });

  it("returns total amount stacked", () => {
    const amount = getStackingMinimum() * 1.2;

    stackers.forEach((stacker) => {
      const { result } = stackStx(
        stacker,
        amount,
        1000,
        6,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
    });

    const responseCycle1 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(1)],
      address1
    );
    expect(responseCycle1.result).toBeUint(amount * 3);
  });

  it("returns 0 in the cycle before stacking starts", () => {
    const amount = getStackingMinimum() * 1.2;

    // stacking txs sent in cycle 0, so stackers will be start in cycle 1
    stackers.forEach((stacker) => {
      stackStx(
        stacker,
        amount,
        1000,
        6,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
    });

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(0)],
      address1
    );
    expect(response.result).toBeUint(0);
  });

  it("returns total amount stacked", () => {
    const amount = getStackingMinimum() * 1.2;

    stackers.forEach((stacker) => {
      stackStx(
        stacker,
        amount,
        1000,
        6,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
    });

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(1)],
      address1
    );
    expect(response.result).toBeUint(amount * 3);
  });

  it("expires stacking after the stacking duration has finsihed", () => {
    const amount = getStackingMinimum() * 1.2;

    stackers.forEach((stacker, i) => {
      const { result } = stackStx(
        stacker,
        amount,
        1000,
        // wallet_1 will expire after 2 cycles, wallet_2 after 4, wallet_3 after 6
        (i + 1) * 2,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
      expect(result).toHaveClarityType(ClarityType.ResponseOk);
    });

    const responseCycle3 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(3)],
      address1
    );
    expect(responseCycle3.result).toBeUint(amount * 2);

    const responseCycle5 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(5)],
      address1
    );
    expect(responseCycle5.result).toBeUint(amount * 1);

    const responseCycle7 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-total-ustx-stacked",
      [Cl.uint(7)],
      address1
    );
    expect(responseCycle7.result).toBeUint(0);
  });
});

describe("test `get-reward-set-pox-address`", () => {
  it("returns none when there is no stacker", () => {
    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-pox-address",
      [Cl.uint(0), Cl.uint(0)],
      address1
    );
    expect(result).toBeNone();
  });

  it("returns pox address for a stacker", () => {
    const amount = getStackingMinimum() * 1.2;
    stackers.forEach((stacker) => {
      stackStx(
        stacker,
        amount,
        1000,
        6,
        amount,
        stacker.authId,
        stacker.stxAddress
      );
    });

    const responseStacker0 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-pox-address",
      [Cl.uint(1), Cl.uint(0)],
      address1
    );
    expect(responseStacker0.result).toBeSome(
      Cl.tuple({
        "pox-addr": poxAddressToTuple(stackers[0].btcAddr),
        signer: Cl.bufferFromHex(stackers[0].signerPubKey),
        stacker: Cl.some(Cl.principal(stackers[0].stxAddress)),
        "total-ustx": Cl.uint(amount),
      })
    );
    const responseStacker1 = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-reward-set-pox-address",
      [Cl.uint(1), Cl.uint(1)],
      address1
    );
    expect(responseStacker1.result).toBeSome(
      Cl.tuple({
        "pox-addr": poxAddressToTuple(stackers[1].btcAddr),
        signer: Cl.bufferFromHex(stackers[1].signerPubKey),
        stacker: Cl.some(Cl.principal(stackers[1].stxAddress)),
        "total-ustx": Cl.uint(amount),
      })
    );
  });
});

describe("test `get-stacking-minimum`", () => {
  it("returns the correct minimum amount", () => {
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "get-stacking-minimum",
      [],
      address1
    );
    expect(response.result).toBeUint(125000000000);
  });
});

describe("test `check-pox-addr-version`", () => {
  it("returns true for a valid version", () => {
    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-version",
      [poxAddressToTuple(stackers[0].btcAddr).data.version],
      address1
    );
    expect(result).toBeBool(true);
  });

  it("returns false for an invalid version (> 6)", () => {
    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-version",
      [Cl.buffer(Buffer.from([7]))],
      address1
    );
    expect(result).toBeBool(false);
  });
});

describe("test `check-pox-addr-hashbytes`", () => {
  it("returns true for a valid address", () => {
    const segwitAddress = poxAddressToTuple(
      "36op6KLxdjBeBXnkNPi59UDTT2yZZGBYDm"
    );

    const segwitCheck = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [segwitAddress.data.version, segwitAddress.data.hashbytes],
      address1
    );
    expect(segwitCheck.result).toBeBool(true);

    const taprootAddress = poxAddressToTuple(
      "bc1q82mfyran6u3y8r877vgkje45wlmvh85c7su3ljww9jv762znmrasn5ce59"
    );

    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [taprootAddress.data.version, taprootAddress.data.hashbytes],
      address1
    );
    expect(result).toBeBool(true);
  });
});

describe("test `check-pox-lock-period`", () => {
  it("returns true for a valid lock period", () => {
    for (let i = 1; i <= 12; i++) {
      const { result } = simnet.callReadOnlyFn(
        POX_CONTRACT,
        "check-pox-lock-period",
        [Cl.uint(i)],
        address1
      );
      expect(result).toBeBool(true);
    }
  });

  it("returns false lock period of 0", () => {
    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-lock-period",
      [Cl.uint(0)],
      address1
    );
    expect(result).toBeBool(false);
  });

  it("returns false lock period of 13", () => {
    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-lock-period",
      [Cl.uint(13)],
      address1
    );
    expect(result).toBeBool(false);
  });
});

describe("test `can-stack-stx` and `minimal-can-stack-stx`", () => {
  it("returns true for a valid stacker", () => {
    const stacker = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const canStackArgs = [
      poxAddressToTuple(stacker.btcAddr),
      Cl.uint(amount),
      Cl.uint(1), // first reward cycle
      Cl.uint(6), // lock period
    ];

    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "can-stack-stx",
      canStackArgs,
      address1
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("returns error if amount is too low", () => {
    const stacker = stackers[0];
    const amount = getStackingMinimum() / 2;
    const canStackArgs = [
      poxAddressToTuple(stacker.btcAddr),
      Cl.uint(amount),
      Cl.uint(1), // first reward cycle
      Cl.uint(6), // lock period
    ];

    const { result } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "can-stack-stx",
      canStackArgs,
      address1
    );
    expect(result).toBeErr(Cl.int(ERRORS.ERR_STACKING_THRESHOLD_NOT_MET));
  });

  it("returns error if period is too low or to high", () => {
    const stacker = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const canStackArgsTooLow = [
      poxAddressToTuple(stacker.btcAddr),
      Cl.uint(amount),
      Cl.uint(1), // first reward cycle
      Cl.uint(0), // lock period
    ];

    const { result: resultTooLow } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "can-stack-stx",
      canStackArgsTooLow,
      address1
    );
    expect(resultTooLow).toBeErr(
      Cl.int(ERRORS.ERR_STACKING_INVALID_LOCK_PERIOD)
    );

    const canStackArgsTooHigh = [
      poxAddressToTuple(stacker.btcAddr),
      Cl.uint(amount),
      Cl.uint(1), // first reward cycle
      Cl.uint(13), // lock period
    ];

    const { result: resultTooHigh } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "can-stack-stx",
      canStackArgsTooHigh,
      address1
    );
    expect(resultTooHigh).toBeErr(
      Cl.int(ERRORS.ERR_STACKING_INVALID_LOCK_PERIOD)
    );
  });

  it("returns error if pox address is invalid", () => {
    const addressTupleWrongVersion = Cl.tuple({
      hashbytes: Cl.buffer(
        Buffer.from("j89046x7zv6pm4n00qgqp505nvljnfp6xfznyw")
      ),
      version: Cl.buffer(Buffer.from([7])),
    });
    const amount = getStackingMinimum() * 1.2;
    const canStackArgs = [
      addressTupleWrongVersion,
      Cl.uint(amount),
      Cl.uint(1), // first reward cycle
      Cl.uint(6), // lock period
    ];
    const { result: resultWrongVersion } = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "can-stack-stx",
      canStackArgs,
      address1
    );
    expect(resultWrongVersion).toBeErr(
      Cl.int(ERRORS.ERR_STACKING_INVALID_POX_ADDRESS)
    );
  });
});

describe("test `check-pox-addr-hashbytes`", () => {
  it("returns true for a valid address", () => {
    let poxAddr = poxAddressToTuple(stackers[0].btcAddr);
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [poxAddr.data.version, poxAddr.data.hashbytes],
      address1
    );

    expect(response.result).toBeBool(true);
  });

  it("returns false when a 20 byte hash is too short", () => {
    let version = Cl.bufferFromHex("01");
    let hashbytes = Cl.bufferFromHex("deadbeef");
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [version, hashbytes],
      address1
    );

    expect(response.result).toBeBool(false);
  });

  it("returns false when a 20 byte hash is too long", () => {
    let version = Cl.bufferFromHex("04");
    let hashbytes = Cl.bufferFromHex("deadbeefdeadbeefdeadbeef");
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [version, hashbytes],
      address1
    );

    expect(response.result).toBeBool(false);
  });

  it("returns false when a 32 byte hash is too short", () => {
    let version = Cl.bufferFromHex("05");
    let hashbytes = Cl.bufferFromHex("deadbeefdeadbeefdead");
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [version, hashbytes],
      address1
    );

    expect(response.result).toBeBool(false);
  });

  it("returns false when a 32 byte hash is too long", () => {
    let version = Cl.bufferFromHex("06");
    let hashbytes = Cl.bufferFromHex("deadbeefdeadbeefdeadbeefdeadbeef01");
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [version, hashbytes],
      address1
    );

    expect(response.result).toBeBool(false);
  });

  it("returns false when the version is too high", () => {
    let version = Cl.bufferFromHex("07");
    let hashbytes = Cl.bufferFromHex("deadbeefdeadbeefdeadbeefdeadbeef");
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "check-pox-addr-hashbytes",
      [version, hashbytes],
      address1
    );

    expect(response.result).toBeBool(false);
  });
});

describe("test `minimal-can-stack-stx`", () => {
  it("returns true for valid args", () => {
    const poxAddr = poxAddressToTuple(stackers[0].btcAddr);
    const amount = 1000n;
    const firstCycle = 1n;
    const lockPeriod = 6n;
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "minimal-can-stack-stx",
      [poxAddr, Cl.uint(amount), Cl.uint(firstCycle), Cl.uint(lockPeriod)],
      address1
    );

    expect(response.result).toBeOk(Cl.bool(true));
  });

  it("returns false for a 0 amount", () => {
    const poxAddr = poxAddressToTuple(stackers[0].btcAddr);
    const amount = 0n;
    const firstCycle = 1n;
    const lockPeriod = 6n;
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "minimal-can-stack-stx",
      [poxAddr, Cl.uint(amount), Cl.uint(firstCycle), Cl.uint(lockPeriod)],
      address1
    );

    expect(response.result).toBeErr(Cl.int(ERRORS.ERR_STACKING_INVALID_AMOUNT));
  });

  it("returns false for an invalid lock period", () => {
    const poxAddr = poxAddressToTuple(stackers[0].btcAddr);
    const amount = 1000n;
    const firstCycle = 1n;
    const lockPeriod = 13n;
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "minimal-can-stack-stx",
      [poxAddr, Cl.uint(amount), Cl.uint(firstCycle), Cl.uint(lockPeriod)],
      address1
    );

    expect(response.result).toBeErr(
      Cl.int(ERRORS.ERR_STACKING_INVALID_LOCK_PERIOD)
    );
  });

  it("returns false for a bad address version", () => {
    const poxAddr = poxAddressToTuple(stackers[0].btcAddr);
    poxAddr.data["version"] = Cl.bufferFromHex("0a");
    const amount = 1000n;
    const firstCycle = 1n;
    const lockPeriod = 6n;
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "minimal-can-stack-stx",
      [poxAddr, Cl.uint(amount), Cl.uint(firstCycle), Cl.uint(lockPeriod)],
      address1
    );

    expect(response.result).toBeErr(
      Cl.int(ERRORS.ERR_STACKING_INVALID_POX_ADDRESS)
    );
  });

  it("returns false for a bad address hashbytes", () => {
    const poxAddr = poxAddressToTuple(stackers[0].btcAddr);
    poxAddr.data["hashbytes"] = Cl.bufferFromHex("deadbeef");
    const amount = 1000n;
    const firstCycle = 1n;
    const lockPeriod = 6n;
    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "minimal-can-stack-stx",
      [poxAddr, Cl.uint(amount), Cl.uint(firstCycle), Cl.uint(lockPeriod)],
      address1
    );

    expect(response.result).toBeErr(
      Cl.int(ERRORS.ERR_STACKING_INVALID_POX_ADDRESS)
    );
  });
});

describe("test `verify-signer-key-sig`", () => {
  it("returns `(ok true)` for a valid signature", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account.signerPrivKey,
    };
    const signerSignature = account.client.signPoxSignature(sigArgs);

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeOk(Cl.bool(true));
  });

  it("returns `(ok true)` for a valid prior authorization", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;

    simnet.callPublicFn(
      POX_CONTRACT,
      "set-signer-key-authorization",
      [
        poxAddr,
        Cl.uint(period),
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.bool(true),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      account.stxAddress
    );

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.none(),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeOk(Cl.bool(true));
  });

  it("returns an error if the amount is too high", () => {
    const account = stackers[0];
    const maxAmount = getStackingMinimum();
    const amount = maxAmount * 1.2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account.signerPrivKey,
    };
    const signerSignature = account.client.signPoxSignature(sigArgs);

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeErr(
      Cl.int(ERRORS.ERR_SIGNER_AUTH_AMOUNT_TOO_HIGH)
    );
  });

  it("returns an error for a used authorization", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account.signerPrivKey,
    };
    const signerSignature = account.client.signPoxSignature(sigArgs);

    simnet.callPrivateFn(
      POX_CONTRACT,
      "consume-signer-key-authorization",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeErr(Cl.int(ERRORS.ERR_SIGNER_AUTH_USED));
  });

  it("returns an error for an invalid signature", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account.signerPrivKey,
    };
    const signerSignature = account.client.signPoxSignature(sigArgs);
    const invalidSignature = signerSignature.slice(0, -2);

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(invalidSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeErr(
      Cl.int(ERRORS.ERR_INVALID_SIGNATURE_RECOVER)
    );
  });

  it("returns an error for a signature that does not match", () => {
    const account = stackers[0];
    const account2 = stackers[1];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account2.signerPrivKey,
    };
    const signerSignature = account2.client.signPoxSignature(sigArgs);

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeErr(
      Cl.int(ERRORS.ERR_INVALID_SIGNATURE_PUBKEY)
    );
  });

  it("returns an error if not signature is passed and there is no prior authorization", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;

    const response = simnet.callReadOnlyFn(
      POX_CONTRACT,
      "verify-signer-key-sig",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.none(),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeErr(Cl.int(ERRORS.ERR_NOT_ALLOWED));
  });
});

describe("test `consume-signer-key-authorization`", () => {
  it("returns `(ok true)` for a valid signature", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account.signerPrivKey,
    };
    const signerSignature = account.client.signPoxSignature(sigArgs);

    const response = simnet.callPrivateFn(
      POX_CONTRACT,
      "consume-signer-key-authorization",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeOk(Cl.bool(true));
  });

  it("returns an error for a used authorization", () => {
    const account = stackers[0];
    const amount = getStackingMinimum() * 1.2;
    const maxAmount = amount * 2;
    const poxAddr = poxAddressToTuple(account.btcAddr);
    const rewardCycle = 1;
    const period = 1;
    const authId = 1;
    const topic = Pox4SignatureTopic.AggregateCommit;
    const sigArgs = {
      authId,
      maxAmount,
      rewardCycle,
      period,
      topic,
      poxAddress: account.btcAddr,
      signerPrivateKey: account.signerPrivKey,
    };
    const signerSignature = account.client.signPoxSignature(sigArgs);

    simnet.callPrivateFn(
      POX_CONTRACT,
      "consume-signer-key-authorization",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );

    const response = simnet.callPrivateFn(
      POX_CONTRACT,
      "consume-signer-key-authorization",
      [
        poxAddr,
        Cl.uint(rewardCycle),
        Cl.stringAscii(topic),
        Cl.uint(period),
        Cl.some(Cl.bufferFromHex(signerSignature)),
        Cl.bufferFromHex(account.signerPubKey),
        Cl.uint(amount),
        Cl.uint(maxAmount),
        Cl.uint(authId),
      ],
      address1
    );
    expect(response.result).toBeErr(Cl.int(ERRORS.ERR_SIGNER_AUTH_USED));
  });
});
