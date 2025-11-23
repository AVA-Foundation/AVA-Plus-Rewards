import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "solidity-coverage";

const IOTA_EVM_TESTNET_RPC_URL =
  "https://json-rpc.evm.testnet.iota.cafe";

const ETHEREUM_EVM_MAINNET_RPC_URL = "https://1rpc.io/eth";

const SEPOLIA_RPC_URL =
  "https://eth-sepolia.g.alchemy.com/v2/1Ov3TS8ZjOh0Gmi3eewDFUNz9dxfLA7-";

module.exports = {
  defaultNetwork: "hardhat",
  gasReporter: {
    enabled: false,
  },
  networks: {
    hardhat: { chainId: 31337 },
    iotaEvmTestnet: {
      chainId: 1076,
      url: IOTA_EVM_TESTNET_RPC_URL,
      accounts: [`${process.env.DEPLOYER_ACCOUNT_PRIV_KEY}`],
    },
    ethereumMainnet: {
      chainId: 1,
      url: ETHEREUM_EVM_MAINNET_RPC_URL,
      accounts: [`${process.env.DEPLOYER_ACCOUNT_PRIV_KEY}`],
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      accounts: [`${process.env.DEPLOYER_ACCOUNT_PRIV_KEY}`],
    },
  },
  etherscan: {
    apiKey: "KV3T32M5BVE8Q69AW2953GT3FKX4XHI9D7",
  },
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "prague"
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};
