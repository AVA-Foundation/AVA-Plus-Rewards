# AVA Daily Earn Lockup Smart Contracts

## Installation

`npm i`

## Compile contracts

`npm run compile`

## Run unit-test

`npm run test`

## Configuration

- The deployer account private key is configured in `.env` that is renamed from the template `.env.example`.

### Deploy to local Hardhat

`npm run deploy-hardhat`

### Deploy to IOTA EVM testnet

`npm run deploy-iotaEvmTestnet`

The deployed contract addresses are stored in the folder `deployed-contract-address\iotaEvmTestnet`

**Notice**

The withdraw period of 30 days is auto set again to be 1 day on `testnet` for easier testing.

### Deploy to Ethereum mainnet

`npm run deploy-ethereumMainnet`

The deployed contract addresses are stored in the folder `deployed-contract-address\ethereumMainnet`

### Init user data

#### On IOTA EVM testnet

`npm run init-user-data-iotaEvmTestnet`

#### On Ethereum mainnet

`npm run init-user-data-ethereumMainnet`

**Notice**

The script `init-user-data.ts` will auto look up for the deployed contract address in the folder `deployed-contract-address`.

Input data is specified directly in the script `init-user-data.ts`.

### Update withdrawal period

#### On IOTA EVM testnet

`npm run update-withdraw-period-iotaEvmTestnet`

#### On Ethereum mainnet

`npm run update-withdraw-period-ethereumMainnet`

**Notice**

Input data is specified directly in the script `update-common-withdraw-period.ts`.
