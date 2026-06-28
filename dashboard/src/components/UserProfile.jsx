import React, { useState, useEffect } from "react";
import {
  Box,
  HStack,
  Avatar,
  VStack,
  Text,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { getAccessToken, removeAccessToken } from "../config/discord";

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load user");
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error("Error loading user:", err);
      removeAccessToken();
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeAccessToken();
    window.location.href = "/login";
  };

  if (loading) {
    return <Spinner size="sm" />;
  }

  if (!user) {
    return null;
  }

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;

  return (
    <Menu>
      <MenuButton as={Button} variant="ghost" p={0}>
        <HStack spacing={3}>
          <Avatar size="sm" name={user.username} src={avatarUrl} />
          <VStack spacing={0} align="start">
            <Text fontSize="sm" fontWeight="bold">
              {user.username}
            </Text>
            <Text fontSize="xs" color="gray.400">
              #{user.discriminator}
            </Text>
          </VStack>
          <ChevronDownIcon />
        </HStack>
      </MenuButton>
      <MenuList bg="gray.800" borderColor="gray.700">
        <MenuItem onClick={loadUser} bg="gray.800" _hover={{ bg: "gray.700" }}>
          Refresh
        </MenuItem>
        <MenuItem onClick={handleLogout} bg="gray.800" _hover={{ bg: "gray.700" }} color="red.400">
          Logout
        </MenuItem>
      </MenuList>
    </Menu>
  );
}

