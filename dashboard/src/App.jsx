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

const BOT_API_URL = process.env.REACT_APP_BOT_API_URL || "https://ade-production-d78d.up.railway.app";

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const SidebarItem = ({ icon, label, isActive, onClick }) => (
  <MotionFlex
    as="button"
    w="full"
    align="center"
    py={3}
    px={4}
    borderRadius={0}
    cursor="pointer"
    bg={isActive ? "#5865F2" : "transparent"}
    color={isActive ? "#ffffff" : "#B9BBBE"}
    fontWeight={isActive ? "bold" : "medium"}
    transition="all 0.15s"
    _hover={{
      bg: isActive ? "#4752c4" : "#36393f",
      color: "#ffffff",
    }}
    onClick={onClick}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <Icon as={icon} mr={3} boxSize={5} />
    <Text>{label}</Text>
  </MotionFlex>
);

export default function App() {
  const [activeTab, setActiveTab] = useState("messages");
  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState({});
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Form state
  const [selectedGuild, setSelectedGuild] = useState("");
  const [welcomeChannel, setWelcomeChannel] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
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
      const res = await fetch(`${BOT_API_URL}/api/discord/config`);
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
    if (selectedGuild) loadChannels(selectedGuild, "both");
  }, [selectedGuild, loadChannels]);

  const saveConfig = async () => {
    if (!selectedGuild) {
      toast({
        title: "Error",
        description: "Please select a server",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const guildName = guilds.find((g) => g.id === selectedGuild)?.name || "Unknown";

    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: selectedGuild,
          guildName,
          welcomeChannelId: welcomeChannel,
          welcomeMessage,
          welcomeEnabled,
          leaveChannelId: leaveChannel,
          leaveMessage,
          leaveEnabled,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Configuration saved!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadConfigs();
      }
    } catch (err) {
      console.error("Error saving config:", err);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="#36393f">
        <Spinner size="xl" color="#5865F2" />
      </Box>
    );
  }

  return (
    <Flex minH="100vh" bg="#36393f">
      {/* Sidebar */}
      <MotionBox
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        w="280px"
        bg="#202225"
        borderRight="1px"
        borderColor="#202225"
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
            borderColor="#5865F2"
          />
          <VStack align="start" ml={4} spacing={0}>
            <Heading size="md" color="#ffffff">
              Celestial
            </Heading>
            <Text fontSize="xs" color="#72767d">
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
            label="Messages"
            isActive={activeTab === "messages"}
            onClick={() => setActiveTab("messages")}
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
          <Divider borderColor="#202225" />
          <Button
            leftIcon={<FaEye />}
            colorScheme="blue"
            variant="outline"
            w="full"
            onClick={onOpen}
            borderColor="#5865F2"
            color="#5865F2"
            borderRadius={0}
            _hover={{
              bg: "#5865F2",
              color: "#ffffff",
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
                <Heading size="2xl" mb={2} color="#ffffff">
                  Welcome back!
                </Heading>
                <Text color="#72767d" fontSize="lg">
                  Manage your Celestial bot settings here
                </Text>
              </Box>

              {/* Stats Cards */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr", lg: "repeat(4, 1fr)" }} gap={6}>
                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Servers</StatLabel>
                    <StatNumber color="#5865F2">{stats.guildCount}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="green" borderRadius={0}>+2 this week</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Total Users</StatLabel>
                    <StatNumber color="#5865F2">{stats.userCount.toLocaleString()}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="blue" borderRadius={0}>Active</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Active Servers</StatLabel>
                    <StatNumber color="#5865F2">{stats.activeGuilds}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="purple" borderRadius={0}>{Math.round((stats.activeGuilds / stats.guildCount) * 100)}%</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Messages Sent</StatLabel>
                    <StatNumber color="#5865F2">{stats.messagesSent.toLocaleString()}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="orange" borderRadius={0}>This month</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>
              </Grid>

              {/* Quick Actions */}
              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <Heading size="lg" mb={6} color="#ffffff">
                  Quick Actions
                </Heading>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <Button
                    leftIcon={<FaDoorOpen />}
                    colorScheme="blue"
                    size="lg"
                    onClick={() => setActiveTab("messages")}
                    borderRadius={0}
                    bg="#5865F2"
                    _hover={{ bg: "#4752c4" }}
                  >
                    Setup Messages
                  </Button>
                </Grid>
              </Box>

              {/* Saved Configs */}
              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <Heading size="lg" mb={6} color="#ffffff">
                  Saved Configurations
                </Heading>
                {configs.length === 0 ? (
                  <Text color="#72767d">No configurations saved yet</Text>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {configs.map((config) => (
                      <Box key={config.guildId} bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                        <Text fontWeight="bold" color="#ffffff">{config.guildName}</Text>
                        <Text fontSize="sm" color="#72767d">
                          Welcome: {config.welcomeEnabled ? "Enabled" : "Disabled"} | Leave:{" "}
                          {config.leaveEnabled ? "Enabled" : "Disabled"}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          </MotionBox>
        )}

        {activeTab === "messages" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="#ffffff">
                  Welcome & Leave Messages
                </Heading>
                <Text color="#72767d">Configure your welcome and leave messages</Text>
              </Box>

              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <VStack spacing={8} align="stretch">
                  {/* Server Selection */}
                  <FormControl>
                    <FormLabel fontWeight="bold" color="#ffffff">Server</FormLabel>
                    <Select
                      placeholder="Select a server..."
                      value={selectedGuild}
                      onChange={(e) => setSelectedGuild(e.target.value)}
                      bg="#36393f"
                      borderColor="#202225"
                      borderRadius={0}
                      color="#ffffff"
                      _focus={{
                        borderColor: "#5865F2",
                        boxShadow: "0 0 0 1px #5865F2",
                      }}
                    >
                      {guilds.map((guild) => (
                        <option key={guild.id} value={guild.id}>
                          {guild.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <Divider borderColor="#202225" />

                  {/* Welcome Section */}
                  <Box>
                    <Heading size="md" mb={4} color="#ffffff">
                      Welcome Message
                    </Heading>
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel fontWeight="bold" color="#ffffff">Channel</FormLabel>
                        <Select
                          placeholder="Select a channel..."
                          value={welcomeChannel}
                          onChange={(e) => setWelcomeChannel(e.target.value)}
                          bg="#36393f"
                          borderColor="#202225"
                          borderRadius={0}
                          color="#ffffff"
                          isDisabled={!selectedGuild}
                          _focus={{
                            borderColor: "#5865F2",
                            boxShadow: "0 0 0 1px #5865F2",
                          }}
                        >
                          {(channels.both || []).map((channel) => (
                            <option key={channel.id} value={channel.id}>
                              #{channel.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontWeight="bold" color="#ffffff">Message</FormLabel>
                        <Textarea
                          placeholder="Use {user}, {username}, {guild}, {memberCount}"
                          value={welcomeMessage}
                          onChange={(e) => setWelcomeMessage(e.target.value)}
                          bg="#36393f"
                          borderColor="#202225"
                          borderRadius={0}
                          color="#ffffff"
                          minH="120px"
                          _focus={{
                            borderColor: "#5865F2",
                            boxShadow: "0 0 0 1px #5865F2",
                          }}
                        />
                      </FormControl>

                      <FormControl display="flex" alignItems="center">
                        <Checkbox
                          isChecked={welcomeEnabled}
                          onChange={(e) => setWelcomeEnabled(e.target.checked)}
                          mr={3}
                          colorScheme="blue"
                          size="lg"
                        />
                        <FormLabel mb={0} fontWeight="medium" color="#ffffff">Enable Welcome Message</FormLabel>
                      </FormControl>
                    </VStack>
                  </Box>

                  <Divider borderColor="#202225" />

                  {/* Leave Section */}
                  <Box>
                    <Heading size="md" mb={4} color="#ffffff">
                      Leave Message
                    </Heading>
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel fontWeight="bold" color="#ffffff">Channel</FormLabel>
                        <Select
                          placeholder="Select a channel..."
                          value={leaveChannel}
                          onChange={(e) => setLeaveChannel(e.target.value)}
                          bg="#36393f"
                          borderColor="#202225"
                          borderRadius={0}
                          color="#ffffff"
                          isDisabled={!selectedGuild}
                          _focus={{
                            borderColor: "#5865F2",
                            boxShadow: "0 0 0 1px #5865F2",
                          }}
                        >
                          {(channels.both || []).map((channel) => (
                            <option key={channel.id} value={channel.id}>
                              #{channel.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontWeight="bold" color="#ffffff">Message</FormLabel>
                        <Textarea
                          placeholder="Use {user}, {username}, {guild}, {memberCount}"
                          value={leaveMessage}
                          onChange={(e) => setLeaveMessage(e.target.value)}
                          bg="#36393f"
                          borderColor="#202225"
                          borderRadius={0}
                          color="#ffffff"
                          minH="120px"
                          _focus={{
                            borderColor: "#5865F2",
                            boxShadow: "0 0 0 1px #5865F2",
                          }}
                        />
                      </FormControl>

                      <FormControl display="flex" alignItems="center">
                        <Checkbox
                          isChecked={leaveEnabled}
                          onChange={(e) => setLeaveEnabled(e.target.checked)}
                          mr={3}
                          colorScheme="blue"
                          size="lg"
                        />
                        <FormLabel mb={0} fontWeight="medium" color="#ffffff">Enable Leave Message</FormLabel>
                      </FormControl>
                    </VStack>
                  </Box>

                  <Button
                    colorScheme="blue"
                    onClick={saveConfig}
                    size="lg"
                    borderRadius={0}
                    bg="#5865F2"
                    _hover={{
                      bg: "#4752c4",
                    }}
                  >
                    Save Configuration
                  </Button>
                </VStack>
              </Box>

              {/* Variables Info */}
              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <Heading size="md" mb={6} color="#ffffff">
                  Available Variables
                </Heading>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{user}"}</Text>
                    <Text color="#72767d">User mention (@username)</Text>
                  </Box>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{username}"}</Text>
                    <Text color="#72767d">Username without mention</Text>
                  </Box>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{guild}"}</Text>
                    <Text color="#72767d">Server name</Text>
                  </Box>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{memberCount}"}</Text>
                    <Text color="#72767d">Number of members</Text>
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
                <Heading size="2xl" mb={2} color="#ffffff">
                  Settings
                </Heading>
                <Text color="#72767d">General bot and dashboard settings</Text>
              </Box>

              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <VStack spacing={6} align="stretch">
                  <Text fontSize="lg" fontWeight="bold" color="#ffffff">
                    Coming Soon!
                  </Text>
                  <Text color="#72767d">
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
        <DrawerContent bg="#202225" borderRight="1px" borderColor="#202225">
          <DrawerHeader borderBottom="1px" borderColor="#202225">
            <Flex align="center">
              <Avatar
                src="/celestial-logo-slim.png"
                size="md"
                name="Celestial"
                mr={3}
                border="2px solid"
                borderColor="#5865F2"
              />
              <Heading size="lg" color="#ffffff">
                Bot Stats Preview
              </Heading>
            </Flex>
          </DrawerHeader>

          <DrawerBody>
            <VStack spacing={6} pt={4}>
              <Box bg="#2f3136" border="1px" borderColor="#202225" w="full" borderRadius={0} p={6}>
                <Stat>
                  <StatLabel color="#72767d">
                    <Flex align="center">
                      <Icon as={FaServer} mr={2} />
                      Total Servers
                    </Flex>
                  </StatLabel>
                  <StatNumber color="#5865F2">{stats.guildCount}</StatNumber>
                </Stat>
              </Box>

              <Box bg="#2f3136" border="1px" borderColor="#202225" w="full" borderRadius={0} p={6}>
                <Stat>
                  <StatLabel color="#72767d">
                    <Flex align="center">
                      <Icon as={FaUsers} mr={2} />
                      Total Users
                    </Flex>
                  </StatLabel>
                  <StatNumber color="#5865F2">{stats.userCount.toLocaleString()}</StatNumber>
                </Stat>
              </Box>

              <Box bg="#2f3136" border="1px" borderColor="#202225" w="full" borderRadius={0} p={6}>
                <Stat>
                  <StatLabel color="#72767d">
                    <Flex align="center">
                      <Icon as={FaChartLine} mr={2} />
                      Active Rate
                    </Flex>
                  </StatLabel>
                  <StatNumber color="#5865F2">
                    {Math.round((stats.activeGuilds / stats.guildCount) * 100)}%
                  </StatNumber>
                </Stat>
              </Box>

              <Box bg="#2f3136" border="1px" borderColor="#202225" w="full" borderRadius={0} p={6}>
                <Stat>
                  <StatLabel color="#72767d">
                    <Flex align="center">
                      <Icon as={FaDiscord} mr={2} />
                      Active Features
                    </Flex>
                  </StatLabel>
                  <StatNumber color="#5865F2">2</StatNumber>
                  <StatHelpText color="#72767d">Welcome & Leave</StatHelpText>
                </Stat>
              </Box>

              <Divider borderColor="#202225" />

              <Text color="#72767d" fontSize="sm" textAlign="center">
                Stats are simulated for preview
              </Text>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
