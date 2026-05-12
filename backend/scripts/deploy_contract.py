#!/usr/bin/env python3
"""
One-time deployment script for the MedLock smart contract on Ethereum Sepolia.

Prerequisites:
  pip install py-solc-x
  Make sure .env has WEB3_PROVIDER_URL and ETHEREUM_PRIVATE_KEY set.
  Your wallet must have Sepolia ETH (get free testnet ETH from https://sepoliafaucet.com).

Usage (from the backend/ directory):
  python scripts/deploy_contract.py

After it runs, copy the printed contract address into .env:
  ETHEREUM_CONTRACT_ADDRESS=0x...
"""
import os
import sys
from pathlib import Path

# Allow importing from backend/app
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

WEB3_PROVIDER_URL   = os.getenv("WEB3_PROVIDER_URL", "")
ETHEREUM_PRIVATE_KEY = os.getenv("ETHEREUM_PRIVATE_KEY", "")

if not WEB3_PROVIDER_URL or ETHEREUM_PRIVATE_KEY in ("", "your-wallet-private-key"):
    print("ERROR: Set WEB3_PROVIDER_URL and ETHEREUM_PRIVATE_KEY in backend/.env first.")
    sys.exit(1)

try:
    from solcx import compile_source, install_solc
except ImportError:
    print("ERROR: py-solc-x not installed. Run:  pip install py-solc-x")
    sys.exit(1)

from web3 import Web3

SOLIDITY_FILE = Path(__file__).parent.parent / "app" / "contracts" / "MedLock.sol"
SOLIDITY_SOURCE = SOLIDITY_FILE.read_text()
SOLC_VERSION = "0.8.20"
SEPOLIA_CHAIN_ID = 11155111

print(f"Installing solc {SOLC_VERSION} (skipped if already present)...")
install_solc(SOLC_VERSION, show_progress=False)

print("Compiling MedLock.sol...")
compiled = compile_source(SOLIDITY_SOURCE, output_values=["abi", "bin"], solc_version=SOLC_VERSION)
_, interface = compiled.popitem()
abi      = interface["abi"]
bytecode = interface["bin"]

print("Connecting to Sepolia...")
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
if not w3.is_connected():
    print("ERROR: Cannot connect. Check WEB3_PROVIDER_URL.")
    sys.exit(1)

account = w3.eth.account.from_key(ETHEREUM_PRIVATE_KEY)
balance = w3.from_wei(w3.eth.get_balance(account.address), "ether")
print(f"Deploying from : {account.address}")
print(f"Wallet balance : {balance:.6f} ETH")

if balance < 0.001:
    print("WARNING: Balance is very low. Get Sepolia ETH from https://sepoliafaucet.com")

MedLockContract = w3.eth.contract(abi=abi, bytecode=bytecode)
nonce = w3.eth.get_transaction_count(account.address)

deploy_tx = MedLockContract.constructor().build_transaction(
    {
        "from": account.address,
        "nonce": nonce,
        "gas": 300_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": SEPOLIA_CHAIN_ID,
    }
)

signed   = account.sign_transaction(deploy_tx)
tx_hash  = w3.eth.send_raw_transaction(signed.raw_transaction)
print(f"\nTransaction sent : {tx_hash.hex()}")
print("Waiting for confirmation (~15–30 s)...")

receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

if receipt["status"] != 1:
    print("ERROR: Deployment transaction failed on-chain.")
    sys.exit(1)

contract_address = receipt["contractAddress"]
print(f"\nContract deployed successfully!")
print(f"  Address      : {contract_address}")
print(f"  Block number : {receipt['blockNumber']}")
print(f"\nAdd this line to backend/.env:")
print(f"  ETHEREUM_CONTRACT_ADDRESS={contract_address}")
