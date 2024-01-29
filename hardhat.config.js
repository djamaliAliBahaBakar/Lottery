require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
      hardhat: {
        chainId: 31337,
        blockConfirmations: 1,
      },
      goerli: {
           url: GOERLI_RPC_URL,
           accounts: [GOERLI_PRIVATE_KEY],
           chainId: 5,
           blockConfirmations: 6,
      },
      sepolia: {
           url: SEPOLIA_RPC_URL,
           accounts: [PRIVATE_KEY],
           chainId: 11155111,
           blockConfirmations: 6,
      }

  },
  etherscan: {
            // Your API key for Etherscan
            // Obtain one at https://etherscan.io/
            apiKey: ETHERSCAN_API_KEY,
  },


  solidity: "0.8.19",
  gasReporter: {
         enabled: false,
         outputFile: "gas-report.txt",
         noColors: true,
         currency: "USD",
         //coinmarketcap: COINMARKETCAP_API_KEY,
    },
  namedAccounts: {
      deployer: {
           default: 0,
      },
      player: {
          default: 1
      }
  },
  mocha: {
    timeout: 200000
  }

};
