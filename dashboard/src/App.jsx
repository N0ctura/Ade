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
  GridItem,
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
  Input,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
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
  FaMicrophone,
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

const CardPreview = ({
  isLeave = false,
  imageUrl,
  title,
  subtitle,
  memberCount = 123
}) => {
  // Mock data for preview
  const mockUsername = "TestUser";
  const mockAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";

  // Replace variables in text
  const replaceVars = (text) => {
    return (text || (isLeave ? `Arrivederci ${mockUsername}!` : `Benvenuto ${mockUsername}!`))
      .replace(/{user}/g, `<@123456789>`)
      .replace(/{username}/g, mockUsername)
      .replace(/{guild}/g, "Test Server")
      .replace(/{memberCount}/g, memberCount);
  };

  // Background style
  const getBackgroundStyle = () => {
    if (imageUrl) {
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return {
      background: isLeave
        ? "linear-gradient(135deg, #2c2f33 0%, #23272a 100%)"
        : "linear-gradient(135deg, #5865F2 0%, #57F287 100%)",
    };
  };

  return (
    <Box
      w="800px"
      h="400px"
      borderRadius="lg"
      overflow="hidden"
      position="relative"
      boxShadow="xl"
      style={getBackgroundStyle()}
    >
      {/* Overlay */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="rgba(0,0,0,0.5)"
      />

      {/* Content */}
      <Flex
        position="relative"
        zIndex={1}
        direction="column"
        align="center"
        justify="center"
        h="100%"
        color="white"
      >
        {/* Avatar */}
        <Box
          w="160px"
          h="160px"
          borderRadius="50%"
          border="4px solid white"
          overflow="hidden"
          mb="30px"
          style={isLeave ? { filter: "grayscale(100%)" } : {}}
        >
          <Image
            src={mockAvatar}
            alt="avatar"
            w="100%"
            h="100%"
            objectFit="cover"
          />
        </Box>

        {/* Title */}
        <Text
          fontSize="36px"
          fontWeight="bold"
          mb="10px"
          textAlign="center"
          textShadow="0 2px 4px rgba(0,0,0,0.5)"
        >
          {replaceVars(title)}
        </Text>

        {/* Subtitle */}
        <Text
          fontSize="24px"
          textAlign="center"
          textShadow="0 2px 4px rgba(0,0,0,0.5)"
        >
          {replaceVars(subtitle) || (isLeave ? "Ci mancherai!" : `Sei il ${memberCount}° membro!`)}
        </Text>
      </Flex>
    </Box>
  );
};

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
  const [welcomeImageUrl, setWelcomeImageUrl] = useState("");
  const [welcomeCardTitle, setWelcomeCardTitle] = useState("");
  const [welcomeCardSubtitle, setWelcomeCardSubtitle] = useState("");
  const [leaveChannel, setLeaveChannel] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");
  const [leaveEnabled, setLeaveEnabled] = useState(true);
  const [leaveImageEnabled, setLeaveImageEnabled] = useState(true);
  const [leaveCardTitle, setLeaveCardTitle] = useState("");
  const [leaveCardSubtitle, setLeaveCardSubtitle] = useState("");

  // TTS form state
  const [ttsSourceChannel, setTtsSourceChannel] = useState("");
  const [ttsVoiceChannel, setTtsVoiceChannel] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsLanguage, setTtsLanguage] = useState("it");
  const [ttsPrefixes, setTtsPrefixes] = useState([".", ",", ";", "!"]);
  const [voiceChannels, setVoiceChannels] = useState([]);

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

  const loadVoiceChannels = useCallback(async (guildId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds/${guildId}/voice-channels`);
      if (!res.ok) throw new Error("Failed to load voice channels");
      const data = await res.json();
      setVoiceChannels(data);
    } catch (err) {
      console.error("Error loading voice channels:", err);
    }
  }, []);

  const loadTtsConfig = useCallback(async (guildId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/tts-config/${guildId}`);
      if (!res.ok) throw new Error("Failed to load TTS config");
      const data = await res.json();
      if (data) {
        setTtsSourceChannel(data.ttsSourceChannelId || "");
        setTtsVoiceChannel(data.ttsVoiceChannelId || "");
        setTtsEnabled(data.ttsEnabled || false);
        setTtsLanguage(data.ttsLanguage || "it");
        setTtsPrefixes(data.ttsPrefixes || [".", ",", ";", "!"]);
      }
    } catch (err) {
      console.error("Error loading TTS config:", err);
    }
  }, []);

  const saveTtsConfig = useCallback(async () => {
    if (!selectedGuild) {
      toast({
        title: "Errore",
        description: "Seleziona un server",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const guildName = guilds.find((g) => g.id === selectedGuild)?.name || "Unknown";

    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/tts-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: selectedGuild,
          guildName,
          ttsSourceChannelId: ttsSourceChannel,
          ttsVoiceChannelId: ttsVoiceChannel,
          ttsEnabled,
          ttsLanguage,
          ttsPrefixes,
        }),
      });

      if (res.ok) {
        toast({
          title: "Successo",
          description: "Configurazione TTS salvata!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error("Error saving TTS config:", err);
      toast({
        title: "Errore",
        description: "Impossibile salvare la configurazione TTS",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [selectedGuild, guilds, ttsSourceChannel, ttsVoiceChannel, ttsEnabled, ttsLanguage, ttsPrefixes, toast]);

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
    if (selectedGuild) {
      loadChannels(selectedGuild, "both");
      loadVoiceChannels(selectedGuild);
      loadTtsConfig(selectedGuild);
      const existingConfig = configs.find(c => c.guildId === selectedGuild);
      if (existingConfig) {
        setWelcomeChannel(existingConfig.welcomeChannelId || "");
        setWelcomeMessage(existingConfig.welcomeMessage || "");
        setWelcomeEnabled(existingConfig.welcomeEnabled !== false);
        setWelcomeImageUrl(existingConfig.welcomeImageUrl || "");
        setWelcomeCardTitle(existingConfig.welcomeCardTitle || "");
        setWelcomeCardSubtitle(existingConfig.welcomeCardSubtitle || "");
        setLeaveChannel(existingConfig.leaveChannelId || "");
        setLeaveMessage(existingConfig.leaveMessage || "");
        setLeaveEnabled(existingConfig.leaveEnabled !== false);
        setLeaveImageEnabled(existingConfig.leaveImageEnabled !== false);
        setLeaveCardTitle(existingConfig.leaveCardTitle || "");
        setLeaveCardSubtitle(existingConfig.leaveCardSubtitle || "");
      }
    }
  }, [selectedGuild, loadChannels, loadVoiceChannels, loadTtsConfig, configs]);

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
          welcomeImageUrl,
          welcomeCardTitle,
          welcomeCardSubtitle,
          leaveChannelId: leaveChannel,
          leaveMessage,
          leaveEnabled,
          leaveImageEnabled,
          leaveCardTitle,
          leaveCardSubtitle,
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
            icon={FaMicrophone}
            label="Voce"
            isActive={activeTab === "voice"}
            onClick={() => setActiveTab("voice")}
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

                  {/* Two-column layout: Form + Preview */}
                  <Grid templateColumns="1fr 1fr" gap={8}>
                    {/* Form Column */}
                    <GridItem>
                      <Tabs colorScheme="blue" variant="enclosed">
                        <TabList mb={4}>
                          <Tab color="#ffffff" _selected={{ bg: "#5865F2", color: "#ffffff" }}>Welcome</Tab>
                          <Tab color="#ffffff" _selected={{ bg: "#5865F2", color: "#ffffff" }}>Leave</Tab>
                        </TabList>

                        <TabPanels>
                          <TabPanel p={0}>
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

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Background Image URL (optional)</FormLabel>
                                <Input
                                  placeholder="https://example.com/background.png"
                                  value={welcomeImageUrl}
                                  onChange={(e) => setWelcomeImageUrl(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                />
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Card Title (optional)</FormLabel>
                                <Input
                                  placeholder="Benvenuto {username}!"
                                  value={welcomeCardTitle}
                                  onChange={(e) => setWelcomeCardTitle(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                />
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Card Subtitle (optional)</FormLabel>
                                <Input
                                  placeholder="Sei il {memberCount}° membro di {guild}!"
                                  value={welcomeCardSubtitle}
                                  onChange={(e) => setWelcomeCardSubtitle(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
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
                          </TabPanel>

                          <TabPanel p={0}>
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

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Card Title (optional)</FormLabel>
                                <Input
                                  placeholder="Arrivederci {username}!"
                                  value={leaveCardTitle}
                                  onChange={(e) => setLeaveCardTitle(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                />
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Card Subtitle (optional)</FormLabel>
                                <Input
                                  placeholder="Ci mancherai!"
                                  value={leaveCardSubtitle}
                                  onChange={(e) => setLeaveCardSubtitle(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                />
                              </FormControl>

                              <FormControl display="flex" alignItems="center">
                                <Checkbox
                                  isChecked={leaveImageEnabled}
                                  onChange={(e) => setLeaveImageEnabled(e.target.checked)}
                                  mr={3}
                                  colorScheme="blue"
                                  size="lg"
                                />
                                <FormLabel mb={0} fontWeight="medium" color="#ffffff">
                                  Enable Leave Card (Black & White)
                                </FormLabel>
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
                          </TabPanel>
                        </TabPanels>
                      </Tabs>
                    </GridItem>

                    {/* Preview Column */}
                    <GridItem>
                      <Box>
                        <Heading size="md" mb={4} color="#ffffff">
                          Live Preview
                        </Heading>
                        <Tabs colorScheme="blue" variant="enclosed">
                          <TabList mb={4}>
                            <Tab color="#ffffff" _selected={{ bg: "#5865F2", color: "#ffffff" }}>Welcome Card</Tab>
                            <Tab color="#ffffff" _selected={{ bg: "#5865F2", color: "#ffffff" }}>Leave Card</Tab>
                          </TabList>

                          <TabPanels>
                            <TabPanel p={0}>
                              <CardPreview
                                isLeave={false}
                                imageUrl={welcomeImageUrl}
                                title={welcomeCardTitle}
                                subtitle={welcomeCardSubtitle}
                              />
                            </TabPanel>
                            <TabPanel p={0}>
                              <CardPreview
                                isLeave={true}
                                imageUrl={welcomeImageUrl}
                                title={leaveCardTitle}
                                subtitle={leaveCardSubtitle}
                              />
                            </TabPanel>
                          </TabPanels>
                        </Tabs>
                      </Box>
                    </GridItem>
                  </Grid>

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

        {activeTab === "voice" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="#ffffff">
                  Impostazioni Voce
                </Heading>
                <Text color="#72767d">Configura il TTS per il tuo server</Text>
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

                  <Box>
                    <Heading size="md" mb={4} color="#ffffff">
                      Canali
                    </Heading>
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel fontWeight="bold" color="#ffffff">
                          Canale testuale (dove leggere i messaggi)
                        </FormLabel>
                        <Select
                          placeholder="Select a channel..."
                          value={ttsSourceChannel}
                          onChange={(e) => setTtsSourceChannel(e.target.value)}
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
                        <FormLabel fontWeight="bold" color="#ffffff">
                          Canale vocale (dove il bot entra)
                        </FormLabel>
                        <Select
                          placeholder="Select a channel..."
                          value={ttsVoiceChannel}
                          onChange={(e) => setTtsVoiceChannel(e.target.value)}
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
                          {voiceChannels.map((channel) => (
                            <option key={channel.id} value={channel.id}>
                              🔊 {channel.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    </VStack>
                  </Box>

                  <Divider borderColor="#202225" />

                  <Box>
                    <Heading size="md" mb={4} color="#ffffff">
                      Prefissi
                    </Heading>
                    <VStack spacing={6} align="stretch">
                      <Text color="#72767d" fontSize="sm">
                        I prefissi che attivano il TTS (separati da virgola)
                      </Text>
                      <FormControl>
                        <Input
                          placeholder=". , , !"
                          value={ttsPrefixes.join(", ")}
                          onChange={(e) => {
                            const prefixes = e.target.value
                              .split(",")
                              .map((p) => p.trim())
                              .filter((p) => p.length > 0);
                            setTtsPrefixes(prefixes);
                          }}
                          bg="#36393f"
                          borderColor="#202225"
                          borderRadius={0}
                          color="#ffffff"
                          _focus={{
                            borderColor: "#5865F2",
                            boxShadow: "0 0 0 1px #5865F2",
                          }}
                        />
                      </FormControl>
                    </VStack>
                  </Box>

                  <Divider borderColor="#202225" />

                  <FormControl display="flex" alignItems="center">
                    <Checkbox
                      isChecked={ttsEnabled}
                      onChange={(e) => setTtsEnabled(e.target.checked)}
                      mr={3}
                      colorScheme="blue"
                      size="lg"
                    />
                    <FormLabel mb={0} fontWeight="medium" color="#ffffff">
                      Abilita TTS automatico
                    </FormLabel>
                  </FormControl>

                  <Button
                    colorScheme="blue"
                    onClick={saveTtsConfig}
                    size="lg"
                    borderRadius={0}
                    bg="#5865F2"
                    _hover={{
                      bg: "#4752c4",
                    }}
                  >
                    Salva Configurazione
                  </Button>
                </VStack>
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
