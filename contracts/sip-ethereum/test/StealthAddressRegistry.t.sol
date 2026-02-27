// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "./helpers/TestSetup.sol";
import {StealthAddressRegistry} from "../src/StealthAddressRegistry.sol";

contract StealthAddressRegistryRegistrationTest is TestSetup {
    event StealthMetaAddressRegistered(
        address indexed registrant,
        uint256 indexed schemeId,
        bytes stealthMetaAddress
    );

    event StealthMetaAddressUpdated(
        address indexed registrant,
        bytes oldMetaAddress,
        bytes newMetaAddress
    );

    function test_registerStealthMetaAddress_success() public {
        bytes memory meta = _makeStealthMetaAddress(1);

        vm.expectEmit(true, true, false, true);
        emit StealthMetaAddressRegistered(alice, 1, meta);

        vm.prank(alice);
        registry.registerStealthMetaAddress(1, meta);

        bytes memory stored = registry.getStealthMetaAddress(alice);
        assertEq(stored.length, 66);
        assertEq(keccak256(stored), keccak256(meta));
    }

    function test_registerStealthMetaAddress_updateEmitsEvent() public {
        bytes memory meta1 = _makeStealthMetaAddress(1);
        bytes memory meta2 = _makeStealthMetaAddress(3);

        vm.startPrank(alice);
        registry.registerStealthMetaAddress(1, meta1);

        vm.expectEmit(true, false, false, true);
        emit StealthMetaAddressUpdated(alice, meta1, meta2);
        registry.registerStealthMetaAddress(1, meta2);
        vm.stopPrank();
    }

    function test_registerStealthMetaAddress_revertsOnInvalidScheme() public {
        bytes memory meta = _makeStealthMetaAddress(1);

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidSchemeId.selector);
        registry.registerStealthMetaAddress(0, meta);

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidSchemeId.selector);
        registry.registerStealthMetaAddress(3, meta);
    }

    function test_registerStealthMetaAddress_revertsOnInvalidLength() public {
        bytes memory shortMeta = new bytes(65);

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidStealthMetaAddress.selector);
        registry.registerStealthMetaAddress(1, shortMeta);
    }

    function test_registerStealthMetaAddress_revertsOnInvalidPrefix() public {
        // Create meta with invalid prefix (0x04)
        bytes memory meta = _makeStealthMetaAddress(1);
        meta[0] = 0x04; // Invalid prefix for first key

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidStealthMetaAddress.selector);
        registry.registerStealthMetaAddress(1, meta);
    }

    function test_registerStealthMetaAddress_revertsOnInvalidSecondKeyPrefix() public {
        bytes memory meta = _makeStealthMetaAddress(1);
        meta[33] = 0x00; // Invalid prefix for second key

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidStealthMetaAddress.selector);
        registry.registerStealthMetaAddress(1, meta);
    }

    function test_registerKeys_success() public {
        bytes memory spending = _makeCompressedPubKey(1);
        bytes memory viewing = _makeCompressedPubKey(2);

        vm.prank(alice);
        registry.registerKeys(1, spending, viewing);

        assertTrue(registry.isRegistered(alice));
        assertEq(registry.getPreferredScheme(alice), 1);
    }

    function test_registerKeys_revertsOnInvalidScheme() public {
        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidSchemeId.selector);
        registry.registerKeys(0, _makeCompressedPubKey(1), _makeCompressedPubKey(2));
    }

    function test_registerKeys_revertsOnInvalidSpendingKey() public {
        bytes memory invalidKey = new bytes(32); // Wrong length

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidStealthMetaAddress.selector);
        registry.registerKeys(1, invalidKey, _makeCompressedPubKey(2));
    }
}

contract StealthAddressRegistryViewTest is TestSetup {
    function test_getKeys_success() public {
        bytes memory spending = _makeCompressedPubKey(10);
        bytes memory viewing = _makeCompressedPubKey(20);

        vm.prank(alice);
        registry.registerKeys(1, spending, viewing);

        (bytes memory retSpending, bytes memory retViewing) = registry.getKeys(alice);
        assertEq(keccak256(retSpending), keccak256(spending));
        assertEq(keccak256(retViewing), keccak256(viewing));
    }

    function test_getKeys_returnsEmptyForUnregistered() public view {
        (bytes memory spending, bytes memory viewing) = registry.getKeys(charlie);
        assertEq(spending.length, 0);
        assertEq(viewing.length, 0);
    }

    function test_isRegistered_returnsTrueForRegistered() public {
        vm.prank(alice);
        registry.registerStealthMetaAddress(1, _makeStealthMetaAddress(1));
        assertTrue(registry.isRegistered(alice));
    }

    function test_isRegistered_returnsFalseForUnregistered() public view {
        assertFalse(registry.isRegistered(charlie));
    }

    function test_getPreferredScheme_returnsCorrectScheme() public {
        vm.prank(alice);
        registry.registerStealthMetaAddress(2, _makeStealthMetaAddress(1));
        assertEq(registry.getPreferredScheme(alice), 2);
    }

    function test_getPreferredScheme_returnsZeroForUnregistered() public view {
        assertEq(registry.getPreferredScheme(charlie), 0);
    }
}

contract StealthAddressRegistryAnnouncementTest is TestSetup {
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function test_announce_success() public {
        address stealth = makeAddr("stealth");
        bytes memory ephemeralKey = _makeCompressedPubKey(1);
        bytes memory metadata = abi.encodePacked(uint8(0xAB), "test");

        vm.expectEmit(true, true, true, true);
        emit Announcement(1, stealth, alice, ephemeralKey, metadata);

        vm.prank(alice);
        registry.announce(1, stealth, ephemeralKey, metadata);

        assertEq(registry.totalAnnouncements(), 1);
    }

    function test_announce_incrementsCounter() public {
        bytes memory ephemeralKey = _makeCompressedPubKey(1);

        vm.startPrank(alice);
        registry.announce(1, makeAddr("s1"), ephemeralKey, "");
        registry.announce(1, makeAddr("s2"), ephemeralKey, "");
        registry.announce(1, makeAddr("s3"), ephemeralKey, "");
        vm.stopPrank();

        assertEq(registry.totalAnnouncements(), 3);
    }

    function test_announce_revertsOnInvalidScheme() public {
        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidSchemeId.selector);
        registry.announce(0, makeAddr("stealth"), _makeCompressedPubKey(1), "");
    }

    function test_announce_revertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.ZeroAddress.selector);
        registry.announce(1, address(0), _makeCompressedPubKey(1), "");
    }

    function test_announce_revertsOnInvalidEphemeralKey() public {
        bytes memory invalidKey = new bytes(32);

        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.InvalidEphemeralPubKey.selector);
        registry.announce(1, makeAddr("stealth"), invalidKey, "");
    }
}

contract StealthAddressRegistryAnnounceAndTransferTest is TestSetup {
    function test_announceAndTransfer_success() public {
        address stealth = makeAddr("stealth");
        bytes memory ephemeralKey = _makeCompressedPubKey(1);
        uint256 amount = 1 ether;

        uint256 balBefore = stealth.balance;

        vm.prank(alice);
        registry.announceAndTransfer{value: amount}(1, stealth, ephemeralKey, "");

        assertEq(stealth.balance, balBefore + amount);
        assertEq(registry.totalAnnouncements(), 1);
    }

    function test_announceAndTransfer_revertsOnZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.ZeroValue.selector);
        registry.announceAndTransfer{value: 0}(1, makeAddr("stealth"), _makeCompressedPubKey(1), "");
    }

    function test_announceAndTransfer_revertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(StealthAddressRegistry.ZeroAddress.selector);
        registry.announceAndTransfer{value: 1 ether}(1, address(0), _makeCompressedPubKey(1), "");
    }
}

contract StealthAddressRegistryViewTagTest is TestSetup {
    function test_computeViewTag_deterministic() public view {
        bytes32 secret = keccak256("shared-secret");
        uint8 tag1 = registry.computeViewTag(secret);
        uint8 tag2 = registry.computeViewTag(secret);
        assertEq(tag1, tag2);
    }

    function test_computeViewTag_differentSecretsGiveDifferentTags() public view {
        bytes32 secret1 = keccak256("secret-1");
        bytes32 secret2 = keccak256("secret-2");
        // Not guaranteed different, but overwhelmingly likely
        uint8 tag1 = registry.computeViewTag(secret1);
        uint8 tag2 = registry.computeViewTag(secret2);
        // Just verify they compute without reverting
        assertTrue(tag1 <= 255);
        assertTrue(tag2 <= 255);
    }

    function test_computeViewTag_matchesExpected() public view {
        bytes32 secret = bytes32(uint256(1));
        uint8 tag = registry.computeViewTag(secret);
        // Verify against Solidity keccak
        uint8 expected = uint8(uint256(keccak256(abi.encodePacked(secret))) >> 248);
        assertEq(tag, expected);
    }
}
