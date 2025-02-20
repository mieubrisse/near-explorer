const nearApi = require("near-api-js");

const BN = require("bn.js");

const { nearRpcUrl } = require("./config");
const { queryNodeValidators } = require("./db-utils");

const nearRpc = new nearApi.providers.JsonRpcProvider(nearRpcUrl);

let seatPrice = null;
let totalStake = null;
let currentEpochStartHeight = null;
let stakingNodes = new Map();

// TODO: Provide an equivalent method in near-api-js, so we don't need to hack it around.
nearRpc.callViewMethod = async function (contractName, methodName, args) {
  const account = new nearApi.Account({ provider: this });
  return await account.viewFunction(contractName, methodName, args);
};

const queryFinalBlock = async () => {
  return await nearRpc.sendJsonRpc("block", { finality: "final" });
};

const queryEpochStats = async () => {
  const networkProtocolConfig = await nearRpc.sendJsonRpc(
    "EXPERIMENTAL_protocol_config",
    { finality: "final" }
  );
  const epochStatus = await nearRpc.sendJsonRpc("validators", [null]);
  const numSeats =
    networkProtocolConfig.num_block_producer_seats +
    networkProtocolConfig.avg_hidden_validator_seats_per_shard.reduce(
      (a, b) => a + b
    );

  const currentProposals = epochStatus.current_proposals;
  const currentValidators = getCurrentNodes(epochStatus);
  const currentPools = await queryNodeValidators();

  // loop over 'active' validators to push those validators to common Map()
  currentValidators.forEach((validator, i) => {
    const { stake, ...currentValidator } = validator;
    stakingNodes.set(validator.account_id, {
      ...currentValidator,
      currentStake: stake,
      stakingStatus: currentValidators[i].stakingStatus,
    });
  });

  // loop over proposed validators to apply stakingStatus='proposal'
  // and if proposed validators already exist in common Map()
  // we add proposedStake to this validator because of different
  // amount of stake from current to next epoch
  currentProposals.forEach((proposal) => {
    const { stake, ...proposalValidator } = proposal;
    const activeValidator = stakingNodes.get(proposal.account_id);

    if (activeValidator) {
      stakingNodes.set(proposal.account_id, {
        ...activeValidator,
        proposedStake: proposal.stake,
      });
    } else {
      stakingNodes.set(proposal.account_id, {
        ...proposalValidator,
        proposedStake: stake,
        stakingStatus: "proposal",
      });
    }
  });

  // loop over all pools from 'name.near' account
  // to get metadata about those accounts (country, country flag, ect.) and
  // push them to commom Map().
  // this data will be shown on 'mainnet' only because 'name.near' exists only there
  currentPools.forEach((pool) => {
    const activePool = stakingNodes.get(pool.account_id);
    if (activePool) {
      stakingNodes.set(pool.account_id, {
        ...activePool,
      });
    } else {
      stakingNodes.set(pool.account_id, {
        account_id: pool.account_id,
      });
    }
  });

  const { epoch_start_height: epochStartHeight } = epochStatus;
  const {
    epoch_length: epochLength,
    genesis_time: genesisTime,
    genesis_height: genesisHeight,
    protocol_version: epochProtocolVersion,
  } = networkProtocolConfig;

  if (currentEpochStartHeight !== epochStartHeight) {
    // Update seat_price and total_stake each time when epoch starts
    currentEpochStartHeight = epochStartHeight;
    seatPrice = nearApi.validators
      .findSeatPrice(epochStatus.current_validators, numSeats)
      .toString();

    totalStake = currentValidators
      .reduce((acc, node) => acc.add(new BN(node.stake)), new BN(0))
      .toString();
  }

  return {
    epochLength,
    epochStartHeight,
    epochProtocolVersion,
    currentValidators,
    stakingNodes,
    totalStake,
    seatPrice,
    genesisTime,
    genesisHeight,
  };
};

const setValidatorStatus = (validators, status) => {
  for (let i = 0; i < validators.length; i++) {
    validators[i].stakingStatus = status;
  }
};

const getCurrentNodes = (epochStatus) => {
  let {
    current_validators: currentValidators,
    next_validators: nextValidators,
  } = epochStatus;
  const {
    newValidators,
    removedValidators,
  } = nearApi.validators.diffEpochValidators(currentValidators, nextValidators);
  setValidatorStatus(currentValidators, "active");
  setValidatorStatus(newValidators, "joining");
  setValidatorStatus(removedValidators, "leaving");
  currentValidators = currentValidators.concat(newValidators);
  return currentValidators;
};

exports.nearRpc = nearRpc;
exports.queryFinalBlock = queryFinalBlock;
exports.queryEpochStats = queryEpochStats;
