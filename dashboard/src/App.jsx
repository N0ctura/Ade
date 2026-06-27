import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
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
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  useDisclosure,
  Avatar,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Icon,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  FaHome,
  FaWaveSquare,
  FaEye,
  FaDiscord,
  FaChartLine,
  FaUsers,
  FaServer,
  FaCog,
  FaDoorOpen,
} from "react-icons/fa";

const BOT_API_URL = process.env.REACT_APP_BOT_API_URL || "http://localhost:3000";

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const SidebarItem = ({ icon, label, isActive, onClick }) => (
  <MotionFlex
    as="button"
    w="full"
    align="center"
    py={3}
    px={4}
    borderRadius="lg"
    cursor="pointer"
    bg={isActive ? "gold.500" : "transparent"}
    color={isActive ? "gray.900" : "gray.300"}
    fontWeight={isActive ? "bold" : "medium"}
    transition="all 0.2s"
    _hover={{
      bg: isActive ? "gold.500" : "gray.700",
    }}
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <Icon as={icon} mr={3} boxSize={5} />
    <Text>{label}</Text>
  </MotionFlex>
);

export default function App() {
  const [activeTab, setActiveTab] = useState("welcome");
  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState({});
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
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

  // Mock stats data
  const stats = {
    guildCount: 12,
    userCount: 4520,
    activeGuilds: 8,
    messagesSent: 1250,
  };

  const loadGuilds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds`);
      if (!res.ok) throw new Error("Failed to load guilds");
      const data = await res.json();
      setGuilds(data);
    } catch (err) {
      console.error("Error loading guilds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChannels = useCallback(async (guildId, type) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds/${guildId}/channels`);
      if (!res.ok) throw new Error("Failed to load channels");
      const data = await res.json();
      setChannels((prev) => ({ ...prev, [type]: data }));
    } catch (err) {
      console.error("Error loading channels:", err);
    }
  }, []);

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

  useEffect(() => {
    loadGuilds();
    loadConfigs();
  }, [loadGuilds, loadConfigs]);

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
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.900">
        <Spinner size="xl" color="gold.500" />
      </Box>
    );
  }

  return (
    <Flex minH="100vh" bg="gray.900">
      {/* Sidebar */}
      <MotionBox
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        w="280px"
        bg="gray.800"
        borderRight="1px"
        borderColor="gray.700"
        p={5}
        display="flex"
        flexDirection="column"
      >
        {/* Logo Area */}
        <Flex align="center" mb={8}>
          <Avatar
            src="/celestial-logo.png"
            size="lg"
            name="Celestial"
            border="2px solid"
            borderColor="gold.500"
          />
          <VStack align="start" ml={4} spacing={0}>
            <Heading size="md" color="gold.400">
              Celestial
            </Heading>
            <Text fontSize="xs" color="gray.400">
              Bot Dashboard
            </Text>
          </VStack>
        </Flex>

        {/* Navigation */}
        <VStack spacing={2} flex={1} align="stretch">
          <SidebarItem
            icon={FaHome}
            label="Home"
            isActive={activeTab === "home"}
            onClick={() => setActiveTab("home")}
          />
          <SidebarItem
            icon={FaDoorOpen}
            label="Welcome Message"
            isActive={activeTab === "welcome"}
            onClick={() => setActiveTab("welcome")}
          />
          <SidebarItem
            icon={FaWaveSquare}
            label="Leave Message"
            isActive={activeTab === "leave"}
            onClick={() => setActiveTab("leave")}
          />
          <SidebarItem
            icon={FaCog}
            label="Settings"
            isActive={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
          />
        </VStack>

        {/* Preview Button */}
        <VStack spacing={3} mt={4}>
          <Divider borderColor="gray.700" />
          <Button
            leftIcon={<FaEye />}
            colorScheme="gold"
            variant="outline"
            w="full"
            onClick={onOpen}
            borderColor="gold.500"
            color="gold.400"
            _hover={{
              bg: "gold.500",
              color: "gray.900",
            }}
          >
            Preview Stats
          </Button>
        </VStack>
      </MotionBox>

      {/* Main Content */}
      <Box flex={1} p={8} overflowY="auto">
        {activeTab === "home" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} bgGradient="linear(to-r, gold.400, gold.600)" bgClip="text">
                  Welcome back!
                </Heading>
                <Text color="gray.400" fontSize="lg">
                  Manage your Celestial bot settings here
                </Text>
              </Box>

              {/* Stats Cards */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr", lg: "repeat(4, 1fr)" }} gap={6}>
                <Box bg="gray.800" border="1px" borderColor="gray.700" borderRadius="xl" p={6}>
                  <Stat>
                    <StatLabel color="gray.400">Servers</StatLabel>
                    <StatNumber color="gold.400">{stats.guildCount}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="green">+2 this week</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="gray.800" border="1px" borderColor="gray.700" borderRadius="xl" p={6}>
                  <Stat>
                    <StatLabel color="gray.400">Total Users</StatLabel>
                    <StatNumber color="gold.400">{stats.userCount.toLocaleString()}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="blue">Active</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="gray.800" border="1px" borderColor="gray.700" borderRadius="xl" p={6}>
                  <Stat>
                    <StatLabel color="gray.400">Active Servers</StatLabel>
                    <StatNumber color="gold.400">{stats.activeGuilds}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="purple">{Math.round((stats.activeGuilds / stats.guildCount) * 100)}%</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="gray.800" border="1px" borderColor="gray.700" borderRadius="xl" p={6}>
                  <Stat>
                    <StatLabel color="gray.400">Messages Sent</StatLabel>
                    <StatNumber color="gold.400">{stats.messagesSent.toLocaleString()}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="orange">This month</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>
              </Grid>

              {/* Quick Actions */}
              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <Heading size="lg" mb={6} color="gold.400">
                  Quick Actions
                </Heading>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <Button
                    leftIcon={<FaDoorOpen />}
                    colorScheme="green"
                    size="lg"
                    onClick={() => setActiveTab("welcome")}
                    borderRadius="lg"
                  >
                    Setup Welcome
                  </Button>
                  <Button
                    leftIcon={<FaWaveSquare />}
                    colorScheme="red"
                    size="lg"
                    onClick={() => setActiveTab("leave")}
                    borderRadius="lg"
                  >
                    Setup Leave
                  </Button>
                </Grid>
              </Box>

              {/* Saved Configs */}
              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <Heading size="lg" mb={6} color="gold.400">
                  📋 Saved Configurations
                </Heading>
                {configs.length === 0 ? (
                  <Text color="gray.400">No configurations saved yet</Text>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {configs.map((config) => (
                      <Box key={config.guildId} bg="gray.700" p={4} borderRadius="md" border="1px" borderColor="gray.600">
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
          </MotionBox>
        )}

        {activeTab === "welcome" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="gold.400">
                  👋 Welcome Message
                </Heading>
                <Text color="gray.400">Configure your welcome messages for new members</Text>
              </Box>

              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <VStack spacing={6} align="stretch">
                  <FormControl>
                    <FormLabel fontWeight="bold">Server</FormLabel>
                    <Select
                      placeholder="Select a server..."
                      value={welcomeGuild}
                      onChange={(e) => setWelcomeGuild(e.target.value)}
                      bg="gray.700"
                      borderColor="gray.600"
                      borderRadius="lg"
                      _focus={{
                        borderColor: "gold.500",
                        boxShadow: "0 0 0 1px gold.500",
                      }}
                    >
                      {guilds.map((guild) => (
                        <option key={guild.id} value={guild.id}>
                          {guild.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontWeight="bold">Channel</FormLabel>
                    <Select
                      placeholder="Select a channel..."
                      value={welcomeChannel}
                      onChange={(e) => setWelcomeChannel(e.target.value)}
                      bg="gray.700"
                      borderColor="gray.600"
                      borderRadius="lg"
                      isDisabled={!welcomeGuild}
                      _focus={{
                        borderColor: "gold.500",
                        boxShadow: "0 0 0 1px gold.500",
                      }}
                    >
                      {(channels.welcome || []).map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontWeight="bold">Message</FormLabel>
                    <Textarea
                      placeholder="Use {user}, {username}, {guild}, {memberCount}"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      bg="gray.700"
                      borderColor="gray.600"
                      borderRadius="lg"
                      minH="150px"
                      _focus={{
                        borderColor: "gold.500",
                        boxShadow: "0 0 0 1px gold.500",
                      }}
                    />
                  </FormControl>

                  <FormControl display="flex" alignItems="center">
                    <Checkbox
                      isChecked={welcomeEnabled}
                      onChange={(e) => setWelcomeEnabled(e.target.checked)}
                      mr={3}
                      colorScheme="gold"
                      size="lg"
                    />
                    <FormLabel mb={0} fontWeight="medium">Enable Welcome Message</FormLabel>
                  </FormControl>

                  <Button
                    colorScheme="gold"
                    onClick={saveWelcome}
                    size="lg"
                    borderRadius="lg"
                    _hover={{
                      bg: "gold.600",
                    }}
                  >
                    💾 Save Welcome Configuration
                  </Button>
                </VStack>
              </Box>

              {/* Variables Info */}
              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <Heading size="md" mb={6} color="gold.400">
                  📝 Available Variables
                </Heading>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{user}"}</Text>
                    <Text color="gray.400">User mention (@username)</Text>
                  </Box>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{username}"}</Text>
                    <Text color="gray.400">Username without mention</Text>
                  </Box>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{guild}"}</Text>
                    <Text color="gray.400">Server name</Text>
                  </Box>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{memberCount}"}</Text>
                    <Text color="gray.400">Number of members</Text>
                  </Box>
                </Grid>
              </Box>
            </VStack>
          </MotionBox>
        )}

        {activeTab === "leave" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="gold.400">
                  👋 Leave Message
                </Heading>
                <Text color="gray.400">Configure your leave messages for departing members</Text>
              </Box>

              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <VStack spacing={6} align="stretch">
                  <FormControl>
                    <FormLabel fontWeight="bold">Server</FormLabel>
                    <Select
                      placeholder="Select a server..."
                      value={leaveGuild}
                      onChange={(e) => setLeaveGuild(e.target.value)}
                      bg="gray.700"
                      borderColor="gray.600"
                      borderRadius="lg"
                      _focus={{
                        borderColor: "gold.500",
                        boxShadow: "0 0 0 1px gold.500",
                      }}
                    >
                      {guilds.map((guild) => (
                        <option key={guild.id} value={guild.id}>
                          {guild.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontWeight="bold">Channel</FormLabel>
                    <Select
                      placeholder="Select a channel..."
                      value={leaveChannel}
                      onChange={(e) => setLeaveChannel(e.target.value)}
                      bg="gray.700"
                      borderColor="gray.600"
                      borderRadius="lg"
                      isDisabled={!leaveGuild}
                      _focus={{
                        borderColor: "gold.500",
                        boxShadow: "0 0 0 1px gold.500",
                      }}
                    >
                      {(channels.leave || []).map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontWeight="bold">Message</FormLabel>
                    <Textarea
                      placeholder="Use {user}, {username}, {guild}, {memberCount}"
                      value={leaveMessage}
                      onChange={(e) => setLeaveMessage(e.target.value)}
                      bg="gray.700"
                      borderColor="gray.600"
                      borderRadius="lg"
                      minH="150px"
                      _focus={{
                        borderColor: "gold.500",
                        boxShadow: "0 0 0 1px gold.500",
                      }}
                    />
                  </FormControl>

                  <FormControl display="flex" alignItems="center">
                    <Checkbox
                      isChecked={leaveEnabled}
                      onChange={(e) => setLeaveEnabled(e.target.checked)}
                      mr={3}
                      colorScheme="gold"
                      size="lg"
                    />
                    <FormLabel mb={0} fontWeight="medium">Enable Leave Message</FormLabel>
                  </FormControl>

                  <Button
                    colorScheme="gold"
                    onClick={saveLeave}
                    size="lg"
                    borderRadius="lg"
                    _hover={{
                      bg: "gold.600",
                    }}
                  >
                    💾 Save Leave Configuration
                  </Button>
                </VStack>
              </Box>

              {/* Variables Info */}
              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <Heading size="md" mb={6} color="gold.400">
                  📝 Available Variables
                </Heading>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{user}"}</Text>
                    <Text color="gray.400">User mention (@username)</Text>
                  </Box>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{username}"}</Text>
                    <Text color="gray.400">Username without mention</Text>
                  </Box>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{guild}"}</Text>
                    <Text color="gray.400">Server name</Text>
                  </Box>
                  <Box bg="gray.700" p={4} borderRadius="md">
                    <Text fontWeight="bold" color="gold.400">{"{memberCount}"}</Text>
                    <Text color="gray.400">Number of members</Text>
                  </Box>
                </Grid>
              </Box>
            </VStack>
          </MotionBox>
        )}

        {activeTab === "settings" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="gold.400">
                  ⚙️ Settings
                </Heading>
                <Text color="gray.400">General bot and dashboard settings</Text>
              </Box>

              <Box bg="gray.800" p={8} borderRadius="xl" border="1px" borderColor="gray.700">
                <VStack spacing={6} align="stretch">
                  <Text fontSize="lg" fontWeight="bold" color="gold.400">
                    Coming Soon!
                  </Text>
                  <Text color="gray.400">
                    Settings page is under construction. Check back later!
                  </Text>
                </VStack>
              </Box>
            </VStack>
          </MotionBox>
        )}
      </Box>

      {/* Preview Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="md">
        <DrawerOverlay />
        <DrawerContent bg="gray.800" borderRight="1px" borderColor="gray.700">
          <DrawerHeader borderBottom="1px" borderColor="gray.700">
            <Flex align="center">
              <Avatar
                src="/celestial-logo-slim.png"
                size="md"
                name="Celestial"
                mr={3}
                border="2px solid"
                borderColor="gold.500"
              />
              <Heading size="lg" color="gold.400">
                Bot Stats Preview
              </Heading>
            </Flex>
          </DrawerHeader>

          <DrawerBody>
            <VStack spacing={6} pt={4}>
              <Box bg="gray.700" border="1px" borderColor="gray.600" w="full" borderRadius="lg" p={6}>
                <Stat>
                  <StatLabel color="gray.400">
                    <Flex align="center">
                      <Icon as={FaServer} mr={2} />
                      Total Servers
                    </Flex>
                  </StatLabel>
                  <StatNumber color="gold.400">{stats.guildCount}</StatNumber>
                </Stat>
              </Box>

              <Box bg="gray.700" border="1px" borderColor="gray.600" w="full" borderRadius="lg" p={6}>
                <Stat>
                  <StatLabel color="gray.400">
                    <Flex align="center">
                      <Icon as={FaUsers} mr={2} />
                      Total Users
                    </Flex>
                  </StatLabel>
                  <StatNumber color="gold.400">{stats.userCount.toLocaleString()}</StatNumber>
                </Stat>
              </Box>

              <Box bg="gray.700" border="1px" borderColor="gray.600" w="full" borderRadius="lg" p={6}>
                <Stat>
                  <StatLabel color="gray.400">
                    <Flex align="center">
                      <Icon as={FaChartLine} mr={2} />
                      Active Rate
                    </Flex>
                  </StatLabel>
                  <StatNumber color="gold.400">
                    {Math.round((stats.activeGuilds / stats.guildCount) * 100)}%
                  </StatNumber>
                </Stat>
              </Box>

              <Box bg="gray.700" border="1px" borderColor="gray.600" w="full" borderRadius="lg" p={6}>
                <Stat>
                  <StatLabel color="gray.400">
                    <Flex align="center">
                      <Icon as={FaDiscord} mr={2} />
                      Active Features
                    </Flex>
                  </StatLabel>
                  <StatNumber color="gold.400">2</StatNumber>
                  <StatHelpText color="gray.400">Welcome & Leave</StatHelpText>
                </Stat>
              </Box>

              <Divider borderColor="gray.700" />

              <Text color="gray.500" fontSize="sm" textAlign="center">
                Stats are simulated for preview
              </Text>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
