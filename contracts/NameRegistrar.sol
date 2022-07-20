// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title NameRegistrar
/// @author lior-abadi
/// @notice It allows users to generate the name alias that will be associated to their account 
contract NameRegistrar {
    // =========== Variables ===========

    /// @dev Shows the timestamp of a certain commitment
    mapping(bytes32 => uint256) public  commitmentTimesamp;

    /// @notice Time in seconds that a user will have to wait to register a name after it is commited
    /// @dev Currently arround 5 blocks per minute are mined, so this time will be enough to prevent
    /// a frontrunning attack that calls sendCommitment-registerName at once.
    uint256 public constant MIN_COMMITMENT_TIME = 120;

    /// @dev A user commitment will expire 24hs after its first sent
    uint256 public constant COMMITMENT_EXPIRY = 1 days;

    /// @dev Used to determine if a user owns a name
    /// @return The name hash owner by a user
    mapping(address => bytes32) public ownerToNameHash;

    /// @dev Possible getter used by the chain to get a user alias (for display purposes)
    mapping(address => string) public ownerToName;

    /// @dev Used to check if a name is already registered
    mapping(bytes32 => bool) public nameUnavailable;


    // =========== Events ===========

    /// @notice Emitted when a new name is registrer
    /// @param owner the owner of the revealed name
    /// @param registeredName the name registered
    /// @param nameHash the hash of the name registered
    event NameRegistered(address indexed owner, string registeredName, bytes32 nameHash);

    // =========== Errors ===========

    /// @notice Triggered when a user wants to re-commit a commitmentHash
    /// @param commitmentHash the hash of the commitment
    error AlreadyCommited(bytes32 commitmentHash);

    /// @notice Triggered when an already registered user wants to rename themselves
    /// @param currentName the name of the commitment
    /// @param nameHash the hash of the name
    error AlreadyNamed(string currentName, bytes32 nameHash);

    /// @notice Triggered when a user wants to register an uncommited name or if it is not old enough
    /// @param commitmentHash the hash of the commitment
    error NoCommitmentMadeOrMinTimePassed(bytes32 commitmentHash);

    /// @notice Triggered when a user wants to re-commit an expired commitmentHash
    /// @param commitmentHash the hash of the commitment
    error CommitmentExpired(bytes32 commitmentHash);

    /// @notice Triggered when a name is already registered
    /// @param name the committed name
    /// @param nameHash the hash of the name
    error NameUnavailable(string name, bytes32 nameHash);

    // =========== FUNCTIONS ===========

    /// @notice Used to get a commitment hash
    /// @dev This function does not writes any data on chain
    /// @param _name The alias name that is wanted to be claimed
    /// @param _salt A user given salt parameter to decrease the chance to forcely calculate the hash
    /// @return The value of the commitment hash
    function calculateCommitment(
        string memory _name,
        uint256 _salt
    ) public view returns(bytes32){
        bytes32 nameHash = keccak256(bytes(_name));
        return keccak256(abi.encode(nameHash, msg.sender, _salt));
    }


    /// @notice Pushes a commitment into the queue
    /// @dev This will allow the user to claim that name after the minimum time passed.
    /// @param _commitmentHash the commitment hash
    function sendCommitment(bytes32 _commitmentHash) external {
        
        // Checks if a user is already registered
        if(ownerToNameHash[msg.sender] != 0){
            revert AlreadyNamed(ownerToName[msg.sender], ownerToNameHash[msg.sender]);
        }

        // Checks if it is intended to re-commit an expired _commitmentHash
        // E.g. A user commited that hash and calls again this function within that timeframe.
        // Also prevents a user from constantly renewing a hash commitment.
        if(commitmentTimesamp[_commitmentHash] + COMMITMENT_EXPIRY >= block.timestamp){
            revert AlreadyCommited(_commitmentHash);
        }

        commitmentTimesamp[_commitmentHash] = block.timestamp;
    }

    /// @notice Register a previously commited name
    /// @dev Compares a newly generated hash with the previously submitted one and assigns the name alias to an account.
    /// @param _name The alias name that is wanted to be registered
    /// @param _salt A user given salt parameter to decrease the chance to forcely calculate the hash
    function registerName(
        string memory _name,
        uint256 _salt
    ) external {
        bytes32 nameHash = keccak256(bytes(_name));

        _clearCommitment(
            _name,
            nameHash,
            calculateCommitment(_name, _salt)
        );

        ownerToNameHash[msg.sender] = nameHash;
        ownerToName[msg.sender] = _name;
        nameUnavailable[nameHash] = true;

        emit NameRegistered(msg.sender, _name, nameHash);
    }


    function _clearCommitment(
        string memory _name,
        bytes32 _nameHash,
        bytes32 _commitmentHash
    ) internal {   

        // Check if enough time passed or if the commitment was even made
        if(commitmentTimesamp[_commitmentHash] + MIN_COMMITMENT_TIME > block.timestamp){
            revert NoCommitmentMadeOrMinTimePassed(_commitmentHash);
        }

        // Check if the commitment has expired
        if(commitmentTimesamp[_commitmentHash] + COMMITMENT_EXPIRY <= block.timestamp){
            revert CommitmentExpired(_commitmentHash);
        }

        // Check name availability
        if(nameUnavailable[_nameHash]){
            revert NameUnavailable(_name, _nameHash);
        }

        delete commitmentTimesamp[_commitmentHash];
    }

    



}