import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
  Select,
  Textarea,
  FormControl,
  FormLabel,
  Checkbox,
  Spinner,
  Grid,
  useToast,
} from "@chakra-ui/react";

const BOT_API_URL = process.env.REACT_APP_BOT_API_URL || "http://localhost:3000";

export default function App() {
  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState({});
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const toast = useToast();

  // Welcome form state
  const [welcomeGuild, setWelcomeGuild] = useState("");
  const [welcomeChannel, setWelcomeChannel] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);

  // Leave form state
  const [leaveGuild, setLeaveGuild] = useState("");
  const [leaveChannel, setLeaveChannel] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");
  const [leaveEnabled, setLeaveEnabled] = useState(true);

  const loadGuilds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds`);
      if (!res.ok) throw new Error("Failed to load guilds");
      const data = await res.json();
      setGuilds(data);
    } catch (err) {
      console.error("Error loading guilds:", err);
      toast({
        title: "Error",
        description: "Could not load guilds. Make sure the bot is running.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadChannels = useCallback(async (guildId, type) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds/${guildId}/channels`);
      if (!res.ok) throw new Error("Failed to load channels");
      const data = await res.json();
      setChannels((prev) => ({ ...prev, [type]: data }));
    } catch (err) {
      console.error("Error loading channels:", err);
      toast({
        title: "Error",
        description: "Could not load channels.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [toast]);

  const loadConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/configs");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      }
    } catch (err) {
      console.error("Error loading configs:", err);
    }
  }, []);

  // Load guilds on mount
  useEffect(() => {
    loadGuilds();
    loadConfigs();
  }, [loadGuilds, loadConfigs]);

  // Load channels when guild changes
  useEffect(() => {
    if (welcomeGuild) loadChannels(welcomeGuild, "welcome");
  }, [welcomeGuild, loadChannels]);

  useEffect(() => {
    if (leaveGuild) loadChannels(leaveGuild, "leave");
  }, [leaveGuild, loadChannels]);

  const saveWelcome = async () => {
    if (!welcomeGuild || !welcomeChannel || !welcomeMessage) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const guildName = guilds.find((g) => g.id === welcomeGuild)?.name || "Unknown";

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "welcome",
          guildId: welcomeGuild,
          guildName,
          welcomeChannelId: welcomeChannel,
          welcomeMessage,
          welcomeEnabled,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Welcome message saved!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadConfigs();
      }
    } catch (err) {
      console.error("Error saving welcome:", err);
      toast({
        title: "Error",
        description: "Failed to save welcome message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const saveLeave = async () => {
    if (!leaveGuild || !leaveChannel || !leaveMessage) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const guildName = guilds.find((g) => g.id === leaveGuild)?.name || "Unknown";

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "leave",
          guildId: leaveGuild,
          guildName,
          leaveChannelId: leaveChannel,
          leaveMessage,
          leaveEnabled,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Leave message saved!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadConfigs();
      }
    } catch (err) {
      console.error("Error saving leave:", err);
      toast({
        title: "Error",
        description: "Failed to save leave message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box bg="gray.900" minH="100vh" color="white" py={10}>
      <Container maxW="6xl">
        <VStack spacing={10} align="stretch">
          {/* Header */}
          <Box>
            <Heading size="2xl" mb={2}>
              🧩 Ade Dashboard
            </Heading>
            <Text color="gray.400">Manage your Discord bot settings</Text>
          </Box>

          {/* Main Grid */}
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={8}>
            {/* Welcome Card */}
            <Box bg="gray.800" p={8} borderRadius="lg" borderLeft="4px" borderColor="green.500">
              <Heading size="lg" mb={6} color="green.400">
                👋 Welcome Message
              </Heading>

              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Server</FormLabel>
                  <Select
                    placeholder="Select a server..."
                    value={welcomeGuild}
                    onChange={(e) => setWelcomeGuild(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                  >
                    {guilds.map((guild) => (
                      <option key={guild.id} value={guild.id}>
                        {guild.name} ({guild.id})
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Channel</FormLabel>
                  <Select
                    placeholder="Select a channel..."
                    value={welcomeChannel}
                    onChange={(e) => setWelcomeChannel(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                    isDisabled={!welcomeGuild}
                  >
                    {(channels.welcome || []).map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name} ({channel.id})
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Message</FormLabel>
                  <Textarea
                    placeholder="Use {user}, {username}, {guild}, {memberCount}"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                    minH="120px"
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Checkbox
                    isChecked={welcomeEnabled}
                    onChange={(e) => setWelcomeEnabled(e.target.checked)}
                    mr={3}
                  />
                  <FormLabel mb={0}>Enabled</FormLabel>
                </FormControl>

                <Button colorScheme="green" onClick={saveWelcome} w="full">
                  💾 Save Welcome
                </Button>
              </VStack>
            </Box>

            {/* Leave Card */}
            <Box bg="gray.800" p={8} borderRadius="lg" borderLeft="4px" borderColor="red.500">
              <Heading size="lg" mb={6} color="red.400">
                👋 Leave Message
              </Heading>

              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Server</FormLabel>
                  <Select
                    placeholder="Select a server..."
                    value={leaveGuild}
                    onChange={(e) => setLeaveGuild(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                  >
                    {guilds.map((guild) => (
                      <option key={guild.id} value={guild.id}>
                        {guild.name} ({guild.id})
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Channel</FormLabel>
                  <Select
                    placeholder="Select a channel..."
                    value={leaveChannel}
                    onChange={(e) => setLeaveChannel(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                    isDisabled={!leaveGuild}
                  >
                    {(channels.leave || []).map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name} ({channel.id})
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Message</FormLabel>
                  <Textarea
                    placeholder="Use {user}, {username}, {guild}, {memberCount}"
                    value={leaveMessage}
                    onChange={(e) => setLeaveMessage(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                    minH="120px"
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Checkbox
                    isChecked={leaveEnabled}
                    onChange={(e) => setLeaveEnabled(e.target.checked)}
                    mr={3}
                  />
                  <FormLabel mb={0}>Enabled</FormLabel>
                </FormControl>

                <Button colorScheme="red" onClick={saveLeave} w="full">
                  💾 Save Leave
                </Button>
              </VStack>
            </Box>
          </Grid>

          {/* Variables Info */}
          <Box bg="gray.800" p={8} borderRadius="lg" borderLeft="4px" borderColor="blue.500">
            <Heading size="md" mb={4} color="blue.400">
              📝 Available Variables
            </Heading>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <Box>
                <Text fontWeight="bold">{"{user}"}</Text>
                <Text color="gray.400">User mention (@username)</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">{"{username}"}</Text>
                <Text color="gray.400">Username without mention</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">{"{guild}"}</Text>
                <Text color="gray.400">Server name</Text>
              </Box>
              <Box>
                <Text fontWeight="bold">{"{memberCount}"}</Text>
                <Text color="gray.400">Number of members</Text>
              </Box>
            </Grid>
          </Box>

          {/* Saved Configs */}
          <Box bg="gray.800" p={8} borderRadius="lg" borderLeft="4px" borderColor="yellow.500">
            <Heading size="md" mb={4} color="yellow.400">
              📋 Saved Configurations
            </Heading>
            {configs.length === 0 ? (
              <Text color="gray.400">No configurations saved yet</Text>
            ) : (
              <VStack spacing={3} align="stretch">
                {configs.map((config) => (
                  <Box key={config.guildId} bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold">{config.guildName}</Text>
                    <Text fontSize="sm" color="gray.400">
                      Welcome: {config.welcomeEnabled ? "✅" : "❌"} | Leave:{" "}
                      {config.leaveEnabled ? "✅" : "❌"}
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
