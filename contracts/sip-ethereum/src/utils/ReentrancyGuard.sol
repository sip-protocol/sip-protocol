// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReentrancyGuard
 * @notice Prevents reentrant calls to a function
 * @dev Minimal implementation without external dependencies
 */
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    error ReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @notice Prevents a function from being called while it's already executing
     */
    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrantCall();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}
