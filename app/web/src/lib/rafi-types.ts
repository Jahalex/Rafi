/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/rafi.json`.
 */
export type Rafi = {
  "address": "5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg",
  "metadata": {
    "name": "rafi",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "RAFI — P2P Probabilistic Exchange Protocol"
  },
  "docs": [
    "──────────────────────────────────────────────────────────────",
    "RAFI — The Probabilistic Exchange Protocol",
    "──────────────────────────────────────────────────────────────"
  ],
  "instructions": [
    {
      "name": "claimAssetBack",
      "docs": [
        "Seller reclaims their asset from an expired pool."
      ],
      "discriminator": [
        231,
        52,
        23,
        172,
        245,
        60,
        3,
        128
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "assetVault",
          "writable": true
        },
        {
          "name": "sellerAssetAccount",
          "writable": true
        },
        {
          "name": "seller",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimRefund",
      "docs": [
        "Buyer reclaims USDC from an expired pool."
      ],
      "discriminator": [
        15,
        16,
        30,
        161,
        255,
        228,
        97,
        60
      ],
      "accounts": [
        {
          "name": "pool"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "buyerUsdcAccount",
          "writable": true
        },
        {
          "name": "buyer",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createPool",
      "docs": [
        "Seller deposits an asset and opens a new pool."
      ],
      "discriminator": [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "account",
                "path": "protocol.pool_counter",
                "account": "rafiProtocol"
              }
            ]
          }
        },
        {
          "name": "assetVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "assetMint"
        },
        {
          "name": "usdcMint",
          "docs": [
            "VULN-03 FIX: Validate USDC mint matches protocol's official mint."
          ]
        },
        {
          "name": "sellerAssetAccount",
          "writable": true
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createPoolParams"
            }
          }
        }
      ]
    },
    {
      "name": "expirePool",
      "docs": [
        "Mark an unfilled pool as expired after its deadline (permissionless)."
      ],
      "discriminator": [
        197,
        132,
        108,
        174,
        19,
        201,
        67,
        78
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "payer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeProtocol",
      "docs": [
        "Bootstrap the global protocol singleton (one-time)."
      ],
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeProtocolParams"
            }
          }
        }
      ]
    },
    {
      "name": "mintProbability",
      "docs": [
        "Buyer mints a probability position by paying USDC."
      ],
      "discriminator": [
        249,
        223,
        139,
        97,
        249,
        75,
        45,
        5
      ],
      "accounts": [
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "pool.position_count",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "buyerUsdcAccount",
          "writable": true
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "mintProbabilityParams"
            }
          }
        }
      ]
    },
    {
      "name": "pauseProtocol",
      "docs": [
        "Emergency pause (authority only)."
      ],
      "discriminator": [
        144,
        95,
        0,
        107,
        119,
        39,
        248,
        141
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "requestSettlement",
      "docs": [
        "Commit to Switchboard VRF randomness (permissionless)."
      ],
      "discriminator": [
        238,
        127,
        110,
        105,
        43,
        95,
        115,
        41
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "randomnessAccount",
          "writable": true
        },
        {
          "name": "queue"
        },
        {
          "name": "oracle",
          "writable": true
        },
        {
          "name": "recentSlothashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "switchboardProgram"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "settlePool",
      "docs": [
        "Consume VRF, verify winner, distribute atomically (permissionless)."
      ],
      "discriminator": [
        186,
        11,
        231,
        111,
        242,
        241,
        203,
        64
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "winningPosition"
        },
        {
          "name": "randomnessAccount"
        },
        {
          "name": "assetVault",
          "writable": true
        },
        {
          "name": "winnerAssetAccount",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true
        },
        {
          "name": "sellerUsdcAccount",
          "writable": true
        },
        {
          "name": "treasuryUsdcAccount",
          "docs": [
            "VULN-10 FIX: Ensure treasury != seller account."
          ],
          "writable": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "unpauseProtocol",
      "docs": [
        "Resume after pause (authority only)."
      ],
      "discriminator": [
        183,
        154,
        5,
        183,
        105,
        76,
        87,
        18
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateFee",
      "docs": [
        "Update protocol fee (authority only, max 10%)."
      ],
      "discriminator": [
        232,
        253,
        195,
        247,
        148,
        212,
        73,
        222
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateTreasury",
      "docs": [
        "Update treasury address (authority only)."
      ],
      "discriminator": [
        60,
        16,
        243,
        66,
        96,
        59,
        254,
        131
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  121,
                  102,
                  116,
                  95,
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newTreasury",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "probabilityPosition",
      "discriminator": [
        206,
        26,
        129,
        192,
        156,
        200,
        80,
        111
      ]
    },
    {
      "name": "rafiProtocol",
      "discriminator": [
        189,
        86,
        217,
        240,
        121,
        144,
        84,
        95
      ]
    }
  ],
  "events": [
    {
      "name": "assetReclaimed",
      "discriminator": [
        233,
        144,
        124,
        13,
        127,
        136,
        178,
        152
      ]
    },
    {
      "name": "poolCreated",
      "discriminator": [
        202,
        44,
        41,
        88,
        104,
        220,
        157,
        82
      ]
    },
    {
      "name": "poolExpiredEvent",
      "discriminator": [
        20,
        17,
        110,
        69,
        14,
        216,
        222,
        84
      ]
    },
    {
      "name": "poolSettled",
      "discriminator": [
        71,
        220,
        136,
        147,
        65,
        185,
        90,
        47
      ]
    },
    {
      "name": "probabilityMinted",
      "discriminator": [
        174,
        208,
        27,
        118,
        164,
        249,
        200,
        151
      ]
    },
    {
      "name": "protocolUpdated",
      "discriminator": [
        52,
        35,
        157,
        26,
        20,
        117,
        63,
        218
      ]
    },
    {
      "name": "refundClaimed",
      "discriminator": [
        136,
        64,
        242,
        99,
        4,
        244,
        208,
        130
      ]
    },
    {
      "name": "settlementRequestedEvent",
      "discriminator": [
        124,
        33,
        70,
        249,
        31,
        136,
        105,
        70
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "multiplierOutOfRange",
      "msg": "Multiplier must be between ×1.10 (11000 bps) and ×1.80 (18000 bps)"
    },
    {
      "code": 6001,
      "name": "minProbabilityTooLow",
      "msg": "Minimum probability per buyer must be >= 10 bps (0.1%)"
    },
    {
      "code": 6002,
      "name": "minProbabilityTooHigh",
      "msg": "Minimum probability cannot exceed 100% (10000 bps)"
    },
    {
      "code": 6003,
      "name": "invalidPoolDuration",
      "msg": "Pool duration out of allowed range"
    },
    {
      "code": 6004,
      "name": "zeroAssetAmount",
      "msg": "Asset amount must be greater than zero"
    },
    {
      "code": 6005,
      "name": "invalidUsdcMint",
      "msg": "USDC mint does not match official protocol USDC"
    },
    {
      "code": 6006,
      "name": "poolNotOpen",
      "msg": "Pool is not open for participation"
    },
    {
      "code": 6007,
      "name": "probabilityBelowMinimum",
      "msg": "Requested probability below pool minimum"
    },
    {
      "code": 6008,
      "name": "probabilityExceedsRemaining",
      "msg": "Requested probability exceeds available remaining"
    },
    {
      "code": 6009,
      "name": "exceedsMaxSingleBuyer",
      "msg": "Single buyer cannot exceed 95% of a pool"
    },
    {
      "code": 6010,
      "name": "poolExpired",
      "msg": "Pool has expired"
    },
    {
      "code": 6011,
      "name": "insufficientPayment",
      "msg": "Insufficient USDC payment"
    },
    {
      "code": 6012,
      "name": "poolNotFilled",
      "msg": "Pool is not fully filled (100%)"
    },
    {
      "code": 6013,
      "name": "settlementNotRequested",
      "msg": "Pool is not in SettlementRequested state"
    },
    {
      "code": 6014,
      "name": "randomnessNotResolved",
      "msg": "Invalid randomness — VRF result not yet available"
    },
    {
      "code": 6015,
      "name": "invalidWinnerPosition",
      "msg": "Winning position range does not contain VRF result"
    },
    {
      "code": 6016,
      "name": "settlementWindowExpired",
      "msg": "Settlement window expired — must re-request"
    },
    {
      "code": 6017,
      "name": "duplicateAccounts",
      "msg": "Duplicate accounts passed — seller and treasury must differ"
    },
    {
      "code": 6018,
      "name": "poolNotExpired",
      "msg": "Pool has not expired yet — cannot refund"
    },
    {
      "code": 6019,
      "name": "poolAlreadySettled",
      "msg": "Pool was settled — cannot refund"
    },
    {
      "code": 6020,
      "name": "alreadyRefunded",
      "msg": "Position already refunded"
    },
    {
      "code": 6021,
      "name": "poolAlreadyClosed",
      "msg": "Pool is already closed"
    },
    {
      "code": 6022,
      "name": "protocolPaused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6023,
      "name": "unauthorized",
      "msg": "Unauthorized signer"
    },
    {
      "code": 6024,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6025,
      "name": "invalidPoolState",
      "msg": "Invalid pool state for this operation"
    },
    {
      "code": 6026,
      "name": "invalidSwitchboardProgram",
      "msg": "Invalid Switchboard program ID"
    },
    {
      "code": 6027,
      "name": "invalidFee",
      "msg": "Invalid fee value"
    }
  ],
  "types": [
    {
      "name": "assetReclaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "assetAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createPoolParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "multiplierBps",
            "type": "u16"
          },
          {
            "name": "minProbabilityBps",
            "type": "u16"
          },
          {
            "name": "durationSecs",
            "type": "i64"
          },
          {
            "name": "assetAmount",
            "type": "u64"
          },
          {
            "name": "poolTotalUsdc",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "initializeProtocolParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "mintProbabilityParams",
      "docs": [
        "──────────────────────────────────────────────────────────────",
        "MintProbability — buyer acquires a % of probability in a pool.",
        "",
        "Whitepaper §3: \"No cap needed — the multiplier is the natural",
        "deterrent.\" Buying 99% at ×1.4 costs more than the asset is",
        "worth, making it mathematically irrational.",
        "──────────────────────────────────────────────────────────────"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "probabilityBps",
            "docs": [
              "Probability to acquire in bps (100 = 1 %)."
            ],
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "pool",
      "docs": [
        "──────────────────────────────────────────────────────────────",
        "Pool — core escrow PDA for a single probabilistic exchange.",
        "Seeds: [\"pool\", seller, pool_id.to_le_bytes()]",
        "──────────────────────────────────────────────────────────────"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          },
          {
            "name": "poolId",
            "docs": [
              "Unique sequential id assigned at creation."
            ],
            "type": "u64"
          },
          {
            "name": "seller",
            "docs": [
              "Seller who deposited the asset."
            ],
            "type": "pubkey"
          },
          {
            "name": "assetMint",
            "docs": [
              "SPL mint of the pooled asset (e.g. wBTC, wETH, SOL)."
            ],
            "type": "pubkey"
          },
          {
            "name": "assetAmount",
            "docs": [
              "Raw token amount locked in the asset vault."
            ],
            "type": "u64"
          },
          {
            "name": "assetDecimals",
            "docs": [
              "Decimals of the asset mint (cached for display)."
            ],
            "type": "u8"
          },
          {
            "name": "usdcMint",
            "docs": [
              "USDC mint address (native Circle on Solana)."
            ],
            "type": "pubkey"
          },
          {
            "name": "multiplierBps",
            "docs": [
              "Seller-chosen multiplier in bps (11 000 = ×1.10)."
            ],
            "type": "u16"
          },
          {
            "name": "poolTotalUsdc",
            "docs": [
              "Total USDC target  =  asset_spot × multiplier."
            ],
            "type": "u64"
          },
          {
            "name": "usdcCollected",
            "docs": [
              "USDC collected so far."
            ],
            "type": "u64"
          },
          {
            "name": "feeBps",
            "docs": [
              "Protocol fee in bps at time of pool creation (snapshot)."
            ],
            "type": "u16"
          },
          {
            "name": "minProbabilityBps",
            "docs": [
              "Minimum probability a buyer can mint, in bps (10 = 0.1 %)."
            ],
            "type": "u16"
          },
          {
            "name": "totalProbabilitySoldBps",
            "docs": [
              "Cumulative probability sold so far (max 10 000 = 100 %)."
            ],
            "type": "u16"
          },
          {
            "name": "positionCount",
            "docs": [
              "Number of ProbabilityPosition accounts created."
            ],
            "type": "u32"
          },
          {
            "name": "assetVault",
            "docs": [
              "PDA token account holding the locked asset."
            ],
            "type": "pubkey"
          },
          {
            "name": "usdcVault",
            "docs": [
              "PDA token account holding accumulated USDC."
            ],
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp — pool creation."
            ],
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "Unix timestamp — pool expiry deadline."
            ],
            "type": "i64"
          },
          {
            "name": "settledAt",
            "docs": [
              "Unix timestamp — settlement (if settled)."
            ],
            "type": "i64"
          },
          {
            "name": "randomnessAccount",
            "docs": [
              "Switchboard randomness account used for VRF."
            ],
            "type": "pubkey"
          },
          {
            "name": "settlementRequestedSlot",
            "docs": [
              "Slot at which settlement was requested (for window enforcement)."
            ],
            "type": "u64"
          },
          {
            "name": "vrfResult",
            "docs": [
              "Raw VRF result bytes (set at settlement)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "vrfResultBps",
            "docs": [
              "The mapped random value in [0, 10 000) bps."
            ],
            "type": "u16"
          },
          {
            "name": "vrfSlot",
            "docs": [
              "Slot at which VRF was consumed."
            ],
            "type": "u64"
          },
          {
            "name": "winner",
            "docs": [
              "Winner wallet (set at settlement)."
            ],
            "type": "pubkey"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "poolState"
              }
            }
          }
        ]
      }
    },
    {
      "name": "poolCreated",
      "docs": [
        "──────────────────────────────────────────────────────────────",
        "RAFI Protocol Events — emitted for indexing & frontend",
        "──────────────────────────────────────────────────────────────"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "assetMint",
            "type": "pubkey"
          },
          {
            "name": "assetAmount",
            "type": "u64"
          },
          {
            "name": "multiplierBps",
            "type": "u16"
          },
          {
            "name": "poolTotalUsdc",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolExpiredEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "probabilitySoldBps",
            "type": "u16"
          },
          {
            "name": "usdcCollected",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "poolSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "vrfResultBps",
            "type": "u16"
          },
          {
            "name": "vrfSlot",
            "type": "u64"
          },
          {
            "name": "sellerUsdc",
            "type": "u64"
          },
          {
            "name": "feeUsdc",
            "type": "u64"
          },
          {
            "name": "assetAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "poolState",
      "docs": [
        "Pool lifecycle states."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "filled"
          },
          {
            "name": "settlementRequested"
          },
          {
            "name": "settled"
          },
          {
            "name": "expired"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "probabilityMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "positionIndex",
            "type": "u32"
          },
          {
            "name": "probabilityBps",
            "type": "u16"
          },
          {
            "name": "usdcPaid",
            "type": "u64"
          },
          {
            "name": "rangeStartBps",
            "type": "u16"
          },
          {
            "name": "rangeEndBps",
            "type": "u16"
          },
          {
            "name": "poolFilled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "probabilityPosition",
      "docs": [
        "──────────────────────────────────────────────────────────────",
        "ProbabilityPosition — a buyer's stake in a specific pool.",
        "Seeds: [\"position\", pool, position_index.to_le_bytes()]",
        "──────────────────────────────────────────────────────────────"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          },
          {
            "name": "pool",
            "docs": [
              "Pool this position belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "docs": [
              "Buyer wallet."
            ],
            "type": "pubkey"
          },
          {
            "name": "positionIndex",
            "docs": [
              "Sequential index within the pool (0-based)."
            ],
            "type": "u32"
          },
          {
            "name": "probabilityBps",
            "docs": [
              "Probability acquired in bps (100 bps = 1 %)."
            ],
            "type": "u16"
          },
          {
            "name": "usdcPaid",
            "docs": [
              "USDC paid for this position (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "rangeStartBps",
            "docs": [
              "Inclusive start of probability range [start, end)."
            ],
            "type": "u16"
          },
          {
            "name": "rangeEndBps",
            "docs": [
              "Exclusive end of probability range [start, end)."
            ],
            "type": "u16"
          },
          {
            "name": "isRefunded",
            "docs": [
              "Whether this position has been refunded."
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of creation."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolUpdated",
      "docs": [
        "VULN-14 FIX: Use u8 field_id instead of String for CU efficiency.",
        "0 = fee_bps, 1 = treasury, 2 = paused, 3 = unpaused, 4 = usdc_mint"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fieldId",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "refundClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "positionIndex",
            "type": "u32"
          },
          {
            "name": "usdcRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rafiProtocol",
      "docs": [
        "──────────────────────────────────────────────────────────────",
        "Global protocol singleton — tracks counters, fees, admin.",
        "Seeds: [\"rafi_protocol\"]",
        "──────────────────────────────────────────────────────────────"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          },
          {
            "name": "authority",
            "docs": [
              "Multisig authority that can update fee or pause."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "docs": [
              "Treasury wallet that receives protocol fees."
            ],
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "docs": [
              "Official USDC mint address (hardened against fake mints — VULN-03)."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Protocol fee in bps (default 600 = 6 %)."
            ],
            "type": "u16"
          },
          {
            "name": "poolCounter",
            "docs": [
              "Auto-incrementing pool counter (used as pool-id seed)."
            ],
            "type": "u64"
          },
          {
            "name": "totalVolumeUsdc",
            "docs": [
              "Lifetime settled volume in USDC lamports."
            ],
            "type": "u64"
          },
          {
            "name": "totalFeesCollected",
            "docs": [
              "Lifetime fees collected in USDC lamports."
            ],
            "type": "u64"
          },
          {
            "name": "isPaused",
            "docs": [
              "Emergency pause flag."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "settlementRequestedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poolId",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "randomnessAccount",
            "type": "pubkey"
          },
          {
            "name": "requestedSlot",
            "type": "u64"
          },
          {
            "name": "requester",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
