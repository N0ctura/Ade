import React, { useState, useEffect, useCallback, useRef } from "react";
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
  FaPlus,
  FaTrash,
  FaArrowsAlt,
  FaEyeSlash,
  FaUserTag,
} from "react-icons/fa";

// Use relative path so it works both in dev and production
const BOT_API_URL = "";

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// Default card configurations
const getDefaultWelcomeCard = () => ({
  width: 800,
  height: 400,
  layers: [
    {
      id: "bg",
      type: "background",
      visible: true,
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      url: ""
    },
    {
      id: "avatar",
      type: "avatar",
      visible: true,
      x: 320,
      y: 50,
      width: 160,
      height: 160,
      borderWidth: 4,
      borderColor: "#ffffff",
      borderRadius: 50
    },
    {
      id: "title",
      type: "text",
      visible: true,
      x: 400,
      y: 250,
      width: 800,
      height: 50,
      text: "Benvenuto {username}!",
      fontSize: 36,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center"
    },
    {
      id: "subtitle",
      type: "text",
      visible: true,
      x: 400,
      y: 300,
      width: 800,
      height: 40,
      text: "Sei il {memberCount}° membro di {guild}!",
      fontSize: 24,
      fontWeight: "normal",
      color: "#ffffff",
      textAlign: "center"
    }
  ]
});

const getDefaultLeaveCard = () => {
  const defaultCard = getDefaultWelcomeCard();
  const titleLayer = defaultCard.layers.find(l => l.id === "title");
  if (titleLayer) titleLayer.text = "Arrivederci {username}!";
  const subtitleLayer = defaultCard.layers.find(l => l.id === "subtitle");
  if (subtitleLayer) subtitleLayer.text = "Ci mancherai!";
  return defaultCard;
};

// Helper function to replace variables in preview
const replaceVars = (text, mockUsername = "TestUser", memberCount = 123) => {
  return (text || "")
    .replace(/{user}/g, `<@123456789>`)
    .replace(/{username}/g, mockUsername)
    .replace(/{guild}/g, "Test Server")
    .replace(/{memberCount}/g, memberCount);
};

const SidebarCategory = ({ label, children }) => (
  <VStack spacing={1} align="stretch" mb={2}>
    <Text
      fontSize="xs"
      fontWeight="bold"
      color="#72767d"
      textTransform="uppercase"
      letterSpacing="0.05em"
      px={4}
      py={1}
    >
      {label}
    </Text>
    {children}
  </VStack>
);

const SidebarItem = ({ icon, label, isActive, onClick }) => (
  <MotionFlex
    as="button"
    w="full"
    align="center"
    py={2}
    px={4}
    borderRadius={4}
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
    mx={2}
  >
    <Icon as={icon} mr={3} boxSize={4} />
    <Text fontSize="sm">{label}</Text>
  </MotionFlex>
);

// Canvas Preview Component
const CardCanvasPreview = ({ cardConfig, isLeave, selectedLayerId, onLayerSelect, onLayerDrag }) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current || !cardConfig) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height, layers } = cardConfig;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = "#202225";
    ctx.fillRect(0, 0, width, height);

    layers.forEach(layer => {
      if (!layer.visible) return;

      ctx.save();

      switch (layer.type) {
        case "background":
        case "image":
          if (layer.url) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
              if (layer.grayscale || isLeave) {
                const imageData = ctx.getImageData(layer.x, layer.y, layer.width, layer.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                  const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                  data[i] = gray;
                  data[i + 1] = gray;
                  data[i + 2] = gray;
                }
                ctx.putImageData(imageData, layer.x, layer.y);
              }
            };
            img.src = layer.url;
          } else {
            const gradient = ctx.createLinearGradient(layer.x, layer.y, layer.x + layer.width, layer.y + layer.height);
            if (isLeave) {
              gradient.addColorStop(0, "#2c2f33");
              gradient.addColorStop(1, "#23272a");
            } else {
              gradient.addColorStop(0, "#5865F2");
              gradient.addColorStop(1, "#57F287");
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
          }
          break;

        case "avatar":
          const avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
          const avatarImg = new Image();
          avatarImg.crossOrigin = "anonymous";
          avatarImg.onload = () => {
            const radius = (layer.borderRadius || 50) * Math.min(layer.width, layer.height) / 200;
            ctx.beginPath();
            ctx.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, layer.x, layer.y, layer.width, layer.height);

            ctx.restore();
            ctx.save();

            if (layer.borderWidth && layer.borderWidth > 0) {
              ctx.strokeStyle = layer.borderColor || "#ffffff";
              ctx.lineWidth = layer.borderWidth;
              ctx.beginPath();
              ctx.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, radius - layer.borderWidth / 2, 0, Math.PI * 2);
              ctx.closePath();
              ctx.stroke();
            }

            if (isLeave) {
              const imageData = ctx.getImageData(layer.x, layer.y, layer.width, layer.height);
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
              }
              ctx.putImageData(imageData, layer.x, layer.y);
            }
          };
          avatarImg.src = avatarUrl;
          break;

        case "text":
          ctx.fillStyle = layer.color || "#ffffff";
          ctx.font = `${layer.fontWeight || "normal"} ${layer.fontSize || 24}px Arial`;
          ctx.textAlign = layer.textAlign || "center";
          ctx.textBaseline = "middle";

          const processedText = replaceVars(layer.text || "");

          if (layer.textAlign === "center") {
            ctx.fillText(processedText, layer.x + layer.width / 2, layer.y + layer.height / 2);
          } else if (layer.textAlign === "right") {
            ctx.fillText(processedText, layer.x + layer.width, layer.y + layer.height / 2);
          } else {
            ctx.fillText(processedText, layer.x, layer.y + layer.height / 2);
          }
          break;
      }

      // Draw selection box if layer is selected
      if (layer.id === selectedLayerId) {
        ctx.strokeStyle = "#5865F2";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }, [cardConfig, isLeave, selectedLayerId]);

  const getLayerAtPosition = (x, y) => {
    const scaledX = (x / canvasRef.current.offsetWidth) * cardConfig.width;
    const scaledY = (y / canvasRef.current.offsetHeight) * cardConfig.height;

    return [...cardConfig.layers].reverse().find(layer =>
      layer.visible &&
      scaledX >= layer.x &&
      scaledX <= layer.x + layer.width &&
      scaledY >= layer.y &&
      scaledY <= layer.y + layer.height
    );
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const layer = getLayerAtPosition(x, y);

    if (layer) {
      setIsDragging(true);
      onLayerSelect(layer.id);

      const scaledX = (x / canvasRef.current.offsetWidth) * cardConfig.width;
      const scaledY = (y / canvasRef.current.offsetHeight) * cardConfig.height;

      setDragOffset({
        x: scaledX - layer.x,
        y: scaledY - layer.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedLayerId) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaledX = (x / canvasRef.current.offsetWidth) * cardConfig.width;
    const scaledY = (y / canvasRef.current.offsetHeight) * cardConfig.height;

    onLayerDrag(selectedLayerId, {
      x: scaledX - dragOffset.x,
      y: scaledY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "auto",
        cursor: isDragging ? "grabbing" : "default",
        border: "1px solid #36393f"
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};

// Layer Editor Panel
const LayerEditor = ({ layer, onUpdate, onDelete }) => {
  if (!layer) return (
    <Box p={4} color="#72767d">
      <Text>Seleziona un layer per modificarlo</Text>
    </Box>
  );

  return (
    <VStack spacing={4} p={4} align="stretch">
      <Heading size="sm" color="#ffffff">Modifica Layer: {layer.type}</Heading>

      <FormControl display="flex" alignItems="center">
        <Checkbox
          isChecked={layer.visible}
          onChange={(e) => onUpdate({ ...layer, visible: e.target.checked })}
          colorScheme="blue"
          mr={2}
        />
        <FormLabel mb={0} color="#ffffff">Visibile</FormLabel>
      </FormControl>

      <Divider borderColor="#36393f" />

      <Grid templateColumns="1fr 1fr" gap={3}>
        <FormControl>
          <FormLabel color="#B9BBBE" fontSize="sm">X</FormLabel>
          <Input
            type="number"
            value={layer.x}
            onChange={(e) => onUpdate({ ...layer, x: Number(e.target.value) })}
            bg="#36393f"
            borderColor="#202225"
            color="#ffffff"
            borderRadius={0}
          />
        </FormControl>
        <FormControl>
          <FormLabel color="#B9BBBE" fontSize="sm">Y</FormLabel>
          <Input
            type="number"
            value={layer.y}
            onChange={(e) => onUpdate({ ...layer, y: Number(e.target.value) })}
            bg="#36393f"
            borderColor="#202225"
            color="#ffffff"
            borderRadius={0}
          />
        </FormControl>
        <FormControl>
          <FormLabel color="#B9BBBE" fontSize="sm">Larghezza</FormLabel>
          <Input
            type="number"
            value={layer.width}
            onChange={(e) => onUpdate({ ...layer, width: Number(e.target.value) })}
            bg="#36393f"
            borderColor="#202225"
            color="#ffffff"
            borderRadius={0}
          />
        </FormControl>
        <FormControl>
          <FormLabel color="#B9BBBE" fontSize="sm">Altezza</FormLabel>
          <Input
            type="number"
            value={layer.height}
            onChange={(e) => onUpdate({ ...layer, height: Number(e.target.value) })}
            bg="#36393f"
            borderColor="#202225"
            color="#ffffff"
            borderRadius={0}
          />
        </FormControl>
      </Grid>

      {(layer.type === "background" || layer.type === "image") && (
        <>
          <Divider borderColor="#36393f" />
          
          {/* Anteprima immagine */}
          {layer.url && (
            <FormControl mb={3}>
              <FormLabel color="#B9BBBE" fontSize="sm">Anteprima</FormLabel>
              <Box position="relative">
                <img
                  src={layer.url}
                  alt="Anteprima"
                  style={{
                    width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px", border: "1px solid #202225" }}
                />
                <Button
                  onClick={() => onUpdate({ ...layer, url: "" })}
                  position="absolute"
                  top="4px"
                  right="4px"
                  size="xs"
                  colorScheme="red"
                  variant="solid"
                >
                  <FaTrash />
                </Button>
              </Box>
            </FormControl>
          )}
          
          {/* Campo upload da galleria */}
          <FormControl>
            <FormLabel color="#B9BBBE" fontSize="sm">Carica Immagine</FormLabel>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target.result;
                    
                    // Aggiorniamo il layer per coprire TUTTA la card!
                    onUpdate({
                      ...layer,
                      url: base64,
                      width: 800, // Larghezza card
                      height: 400, // Altezza card
                      x: 0,
                      y: 0
                    });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              bg="#36393f"
              borderColor="#202225"
              color="#ffffff"
              borderRadius={0}
            />
          </FormControl>
        </>
      )}

      {layer.type === "text" && (
        <>
          <Divider borderColor="#36393f" />
          <FormControl>
            <FormLabel color="#B9BBBE" fontSize="sm">Testo</FormLabel>
            <Textarea
              value={layer.text || ""}
              onChange={(e) => onUpdate({ ...layer, text: e.target.value })}
              bg="#36393f"
              borderColor="#202225"
              color="#ffffff"
              borderRadius={0}
              minH="60px"
              placeholder="Benvenuto {username}!"
            />
          </FormControl>
          <Grid templateColumns="1fr 1fr" gap={3}>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Dimensione Font</FormLabel>
              <Input
                type="number"
                value={layer.fontSize || 24}
                onChange={(e) => onUpdate({ ...layer, fontSize: Number(e.target.value) })}
                bg="#36393f"
                borderColor="#202225"
                color="#ffffff"
                borderRadius={0}
              />
            </FormControl>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Spessore</FormLabel>
              <Select
                value={layer.fontWeight || "normal"}
                onChange={(e) => onUpdate({ ...layer, fontWeight: e.target.value })}
                bg="#36393f"
                borderColor="#202225"
                color="#ffffff"
                borderRadius={0}
              >
                <option value="normal">Normale</option>
                <option value="bold">Grassetto</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Colore</FormLabel>
              <Input
                type="color"
                value={layer.color || "#ffffff"}
                onChange={(e) => onUpdate({ ...layer, color: e.target.value })}
                bg="#36393f"
                borderColor="#202225"
                borderRadius={0}
                h="40px"
              />
            </FormControl>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Allineamento</FormLabel>
              <Select
                value={layer.textAlign || "center"}
                onChange={(e) => onUpdate({ ...layer, textAlign: e.target.value })}
                bg="#36393f"
                borderColor="#202225"
                color="#ffffff"
                borderRadius={0}
              >
                <option value="left">Sinistra</option>
                <option value="center">Centro</option>
                <option value="right">Destra</option>
              </Select>
            </FormControl>
          </Grid>
        </>
      )}

      {layer.type === "avatar" && (
        <>
          <Divider borderColor="#36393f" />
          <Grid templateColumns="1fr 1fr" gap={3}>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Spessore Bordo</FormLabel>
              <Input
                type="number"
                value={layer.borderWidth || 0}
                onChange={(e) => onUpdate({ ...layer, borderWidth: Number(e.target.value) })}
                bg="#36393f"
                borderColor="#202225"
                color="#ffffff"
                borderRadius={0}
              />
            </FormControl>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Colore Bordo</FormLabel>
              <Input
                type="color"
                value={layer.borderColor || "#ffffff"}
                onChange={(e) => onUpdate({ ...layer, borderColor: e.target.value })}
                bg="#36393f"
                borderColor="#202225"
                borderRadius={0}
                h="40px"
              />
            </FormControl>
            <FormControl>
              <FormLabel color="#B9BBBE" fontSize="sm">Raggio Bordo (%)</FormLabel>
              <Input
                type="number"
                value={layer.borderRadius || 50}
                onChange={(e) => onUpdate({ ...layer, borderRadius: Number(e.target.value) })}
                bg="#36393f"
                borderColor="#202225"
                color="#ffffff"
                borderRadius={0}
                min={0}
                max={100}
              />
            </FormControl>
          </Grid>
        </>
      )}

      {layer.type !== "background" && (
        <>
          <Divider borderColor="#36393f" />
          <Button
            colorScheme="red"
            variant="solid"
            onClick={onDelete}
            leftIcon={<FaTrash />}
            borderRadius={0}
          >
            Elimina Layer
          </Button>
        </>
      )}
    </VStack>
  );
};

// Layer List Component
const LayerList = ({ layers, selectedId, onSelect, onMoveUp, onMoveDown }) => {
  return (
    <VStack spacing={1} p={2} align="stretch">
      <Text color="#72767d" fontSize="sm" px={2} py={1}>Layer (in ordine di rendering)</Text>
      {[...layers].reverse().map((layer, index) => {
        const originalIndex = layers.length - 1 - index;
        return (
          <MotionFlex
            key={layer.id}
            p={2}
            bg={selectedId === layer.id ? "#5865F2" : "#2f3136"}
            color="#ffffff"
            borderRadius={0}
            cursor="pointer"
            onClick={() => onSelect(layer.id)}
            align="center"
            justify="space-between"
            whileHover={{ bg: selectedId === layer.id ? "#4752c4" : "#36393f" }}
          >
            <Flex align="center">
              <Icon as={layer.visible ? FaEye : FaEyeSlash} mr={2} boxSize={3} color="#B9BBBE" />
              <Text fontSize="sm">{layer.type} ({layer.id})</Text>
            </Flex>
            {layer.type !== "background" && (
              <Flex>
                <Button
                  size="xs"
                  variant="ghost"
                  color="#B9BBBE"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp(originalIndex);
                  }}
                  isDisabled={originalIndex === layers.length - 1}
                  borderRadius={0}
                >
                  ↑
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  color="#B9BBBE"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown(originalIndex);
                  }}
                  isDisabled={originalIndex === 0}
                  borderRadius={0}
                >
                  ↓
                </Button>
              </Flex>
            )}
          </MotionFlex>
        );
      })}
    </VStack>
  );
};

const CardEditor = ({ cardConfig, setCardConfig, isLeave }) => {
  const [selectedLayerId, setSelectedLayerId] = useState(null);

  const updateLayer = (updatedLayer) => {
    setCardConfig({
      ...cardConfig,
      layers: cardConfig.layers.map(layer =>
        layer.id === updatedLayer.id ? updatedLayer : layer
      )
    });
  };

  const deleteLayer = () => {
    if (!selectedLayerId) return;
    setCardConfig({
      ...cardConfig,
      layers: cardConfig.layers.filter(layer => layer.id !== selectedLayerId)
    });
    setSelectedLayerId(null);
  };

  const addLayer = (type) => {
    const newLayer = {
      id: `${type}-${Date.now()}`,
      type,
      visible: true,
      x: 100,
      y: 100,
      width: type === "text" ? 300 : 100,
      height: type === "text" ? 40 : 100,
      ...(type === "text" ? {
        text: "Nuovo testo",
        fontSize: 24,
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "center"
      } : {}),
      ...(type === "avatar" ? {
        borderWidth: 4,
        borderColor: "#ffffff",
        borderRadius: 50
      } : {}),
    };
    setCardConfig({
      ...cardConfig,
      layers: [...cardConfig.layers, newLayer]
    });
    setSelectedLayerId(newLayer.id);
  };

  const moveLayerUp = (index) => {
    if (index >= cardConfig.layers.length - 1) return;
    const newLayers = [...cardConfig.layers];
    [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    setCardConfig({ ...cardConfig, layers: newLayers });
  };

  const moveLayerDown = (index) => {
    if (index <= 0) return;
    const newLayers = [...cardConfig.layers];
    [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    setCardConfig({ ...cardConfig, layers: newLayers });
  };

  const handleLayerDrag = (layerId, position) => {
    updateLayer({
      ...cardConfig.layers.find(l => l.id === layerId),
      ...position
    });
  };

  const selectedLayer = cardConfig.layers.find(l => l.id === selectedLayerId);

  return (
    <Grid templateColumns="2fr 1fr 1fr" gap={4} h="600px">
      {/* Canvas Preview */}
      <GridItem bg="#2f3136" borderRadius={0} p={4}>
        <Heading size="sm" color="#ffffff" mb={4}>Anteprima</Heading>
        <CardCanvasPreview
          cardConfig={cardConfig}
          isLeave={isLeave}
          selectedLayerId={selectedLayerId}
          onLayerSelect={setSelectedLayerId}
          onLayerDrag={handleLayerDrag}
        />
      </GridItem>

      {/* Layer List */}
      <GridItem bg="#2f3136" borderRadius={0} overflowY="auto">
        <LayerList
          layers={cardConfig.layers}
          selectedId={selectedLayerId}
          onSelect={setSelectedLayerId}
          onMoveUp={moveLayerUp}
          onMoveDown={moveLayerDown}
        />
        <VStack spacing={2} p={2}>
          <Divider borderColor="#36393f" />
          <Text color="#72767d" fontSize="sm">Aggiungi Layer</Text>
          <Button
            leftIcon={<FaPlus />}
            size="sm"
            onClick={() => addLayer("image")}
            bg="#36393f"
            color="#ffffff"
            borderRadius={0}
            w="full"
            _hover={{ bg: "#40444b" }}
          >
            Immagine
          </Button>
          <Button
            leftIcon={<FaPlus />}
            size="sm"
            onClick={() => addLayer("text")}
            bg="#36393f"
            color="#ffffff"
            borderRadius={0}
            w="full"
            _hover={{ bg: "#40444b" }}
          >
            Testo
          </Button>
          <Button
            leftIcon={<FaPlus />}
            size="sm"
            onClick={() => addLayer("avatar")}
            bg="#36393f"
            color="#ffffff"
            borderRadius={0}
            w="full"
            _hover={{ bg: "#40444b" }}
          >
            Avatar
          </Button>
        </VStack>
      </GridItem>

      {/* Layer Editor */}
      <GridItem bg="#2f3136" borderRadius={0} overflowY="auto">
        <LayerEditor
          layer={selectedLayer}
          onUpdate={updateLayer}
          onDelete={deleteLayer}
        />
      </GridItem>
    </Grid>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Form state
  const [selectedGuild, setSelectedGuild] = useState("");
  const [welcomeChannel, setWelcomeChannel] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeCard, setWelcomeCard] = useState(getDefaultWelcomeCard());
  const [leaveChannel, setLeaveChannel] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");
  const [leaveEnabled, setLeaveEnabled] = useState(true);
  const [leaveCard, setLeaveCard] = useState(getDefaultLeaveCard());
  const [autoroleEnabled, setAutoroleEnabled] = useState(false);
  const [autoroleRoleIds, setAutoroleRoleIds] = useState([]);
  const [roles, setRoles] = useState([]);

  // TTS form state
  const [ttsSourceChannel, setTtsSourceChannel] = useState("");
  const [ttsVoiceChannel, setTtsVoiceChannel] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsLanguage, setTtsLanguage] = useState("it");
  const [ttsPrefixes, setTtsPrefixes] = useState([",", ";", "!"]);
  const [voiceChannels, setVoiceChannels] = useState([]);

  // Scheduled messages state
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [editingScheduledMessage, setEditingScheduledMessage] = useState(null);
  const [scheduledMessageChannelId, setScheduledMessageChannelId] = useState("");
  const [scheduledMessageText, setScheduledMessageText] = useState("");
  const [scheduledMessageIsRecurring, setScheduledMessageIsRecurring] = useState(true);
  const [scheduledMessageInterval, setScheduledMessageInterval] = useState("daily");
  const [scheduledMessageDays, setScheduledMessageDays] = useState(1);
  const [scheduledMessageEnabled, setScheduledMessageEnabled] = useState(true);

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

  const loadChannels = useCallback(async (guildId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds/${guildId}/channels`);
      if (!res.ok) throw new Error("Failed to load channels");
      const data = await res.json();
      setChannels(data);
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

  const loadRoles = useCallback(async (guildId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/guilds/${guildId}/roles`);
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      console.error("Error loading roles:", err);
    }
  }, []);

  const loadTTSConfig = useCallback(async (guildId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/tts-config/${guildId}`);
      if (!res.ok) throw new Error("Failed to load TTS config");
      const data = await res.json();
      setTtsSourceChannel(data.ttsSourceChannelId || "");
      setTtsVoiceChannel(data.ttsVoiceChannelId || "");
      setTtsEnabled(data.ttsEnabled ?? false);
      setTtsLanguage(data.ttsLanguage || "it");
      setTtsPrefixes(data.ttsPrefixes || [",", ";", "!"]);
    } catch (err) {
      console.error("Error loading TTS config:", err);
    }
  }, []);

  const loadScheduledMessages = useCallback(async (guildId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/scheduled-messages/${guildId}`);
      if (!res.ok) throw new Error("Failed to load scheduled messages");
      const data = await res.json();
      setScheduledMessages(data);
    } catch (err) {
      console.error("Error loading scheduled messages:", err);
    }
  }, []);

  const saveScheduledMessage = useCallback(async () => {
    if (!selectedGuild || !scheduledMessageChannelId || !scheduledMessageText) {
      toast({
        title: "Errore",
        description: "Seleziona un server, un canale e scrivi un messaggio",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const guildName = guilds.find((g) => g.id === selectedGuild)?.name || "Unknown";

    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/scheduled-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingScheduledMessage?.id,
          guildId: selectedGuild,
          channelId: scheduledMessageChannelId,
          message: scheduledMessageText,
          isRecurring: scheduledMessageIsRecurring,
          recurrenceInterval: scheduledMessageIsRecurring ? scheduledMessageInterval : undefined,
          scheduledTime: new Date().toISOString(),
          enabled: scheduledMessageEnabled,
        }),
      });

      if (res.ok) {
        toast({
          title: "Successo",
          description: "Messaggio automatico salvato!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadScheduledMessages(selectedGuild);
        setEditingScheduledMessage(null);
        setScheduledMessageChannelId("");
        setScheduledMessageText("");
        setScheduledMessageIsRecurring(true);
        setScheduledMessageInterval("daily");
        setScheduledMessageDays(1);
        setScheduledMessageEnabled(true);
      }
    } catch (err) {
      console.error("Error saving scheduled message:", err);
      toast({
        title: "Errore",
        description: "Impossibile salvare il messaggio automatico",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [selectedGuild, guilds, scheduledMessageChannelId, scheduledMessageText, scheduledMessageIsRecurring, scheduledMessageInterval, scheduledMessageEnabled, editingScheduledMessage, toast, loadScheduledMessages]);

  const deleteScheduledMessage = useCallback(async (messageId) => {
    try {
      const res = await fetch(`${BOT_API_URL}/api/discord/scheduled-messages/${messageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Successo",
          description: "Messaggio automatico eliminato!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadScheduledMessages(selectedGuild);
      }
    } catch (err) {
      console.error("Error deleting scheduled message:", err);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il messaggio automatico",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [selectedGuild, toast, loadScheduledMessages]);

  const saveTTSConfig = useCallback(async () => {
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
      loadChannels(selectedGuild);
      loadVoiceChannels(selectedGuild);
      loadRoles(selectedGuild);
      loadTTSConfig(selectedGuild);
      loadScheduledMessages(selectedGuild);
      const existingConfig = configs.find(c => c.guildId === selectedGuild);
      if (existingConfig) {
        setWelcomeChannel(existingConfig.welcomeChannelId || "");
        setWelcomeMessage(existingConfig.welcomeMessage || "");
        setWelcomeEnabled(existingConfig.welcomeEnabled !== false);
        setWelcomeCard(existingConfig.welcomeCard || getDefaultWelcomeCard());
        setLeaveChannel(existingConfig.leaveChannelId || "");
        setLeaveMessage(existingConfig.leaveMessage || "");
        setLeaveEnabled(existingConfig.leaveEnabled !== false);
        setLeaveCard(existingConfig.leaveCard || getDefaultLeaveCard());
        setAutoroleEnabled(existingConfig.autoroleEnabled ?? false);
        setAutoroleRoleIds(existingConfig.autoroleRoleIds || []);
      } else {
        setWelcomeCard(getDefaultWelcomeCard());
        setLeaveCard(getDefaultLeaveCard());
        setAutoroleEnabled(false);
        setAutoroleRoleIds([]);
      }
    }
  }, [selectedGuild, loadChannels, loadVoiceChannels, loadRoles, loadTTSConfig, loadScheduledMessages, configs]);

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
          welcomeCard,
          leaveChannelId: leaveChannel,
          leaveMessage,
          leaveEnabled,
          leaveCard,
          autoroleEnabled,
          autoroleRoleIds,
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

          <SidebarCategory label="Welcome">
            <SidebarItem
              icon={FaDoorOpen}
              label="Messages"
              isActive={activeTab === "messages"}
              onClick={() => setActiveTab("messages")}
            />
            <SidebarItem
              icon={FaUserTag}
              label="Autorole"
              isActive={activeTab === "autorole"}
              onClick={() => setActiveTab("autorole")}
            />
          </SidebarCategory>

          <SidebarCategory label="Messaggi">
            <SidebarItem
              icon={FaWaveSquare}
              label="Messaggi automatici"
              isActive={activeTab === "scheduled-messages"}
              onClick={() => setActiveTab("scheduled-messages")}
            />
            <SidebarItem
              icon={FaMicrophone}
              label="Voce"
              isActive={activeTab === "voice"}
              onClick={() => setActiveTab("voice")}
            />
          </SidebarCategory>

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
                    <StatNumber color="#5865F2">{guilds.length}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="green" borderRadius={0}>+2 this week</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Total Users</StatLabel>
                    <StatNumber color="#5565F2">{guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0).toLocaleString()}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="blue" borderRadius={0}>Active</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Active Servers</StatLabel>
                    <StatNumber color="#5565F2">{configs.length}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme="purple" borderRadius={0}>{configs.length > 0 ? Math.round((configs.length / guilds.length) * 100) : 0}%</Badge>
                    </StatHelpText>
                  </Stat>
                </Box>

                <Box bg="#2f3136" border="1px" borderColor="#202225" borderRadius={0} p={6}>
                  <Stat>
                    <StatLabel color="#72767d">Messages Sent</StatLabel>
                    <StatNumber color="#5565F2">1250</StatNumber>
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
                <Text color="#72767d">Configure your welcome and leave messages with a visual layer editor</Text>
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

                  {selectedGuild && (
                    <>
                      <Divider borderColor="#36393f" />

                      <Tabs colorScheme="blue" variant="enclosed">
                        <TabList>
                          <Tab color="#ffffff" _selected={{ bg: "#5865F2", color: "#ffffff" }}>Welcome</Tab>
                          <Tab color="#ffffff" _selected={{ bg: "#5865F2", color: "#ffffff" }}>Leave</Tab>
                        </TabList>

                        <TabPanels>
                          <TabPanel p={0} pt={4}>
                            <VStack spacing={6} align="stretch">
                              <FormControl display="flex" alignItems="center">
                                <Checkbox
                                  isChecked={welcomeEnabled}
                                  onChange={(e) => setWelcomeEnabled(e.target.checked)}
                                  mr={3}
                                  colorScheme="blue"
                                  size="lg"
                                />
                                <FormLabel mb={0} fontWeight="medium" color="#ffffff">Abilita Messaggio di Benvenuto</FormLabel>
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Canale</FormLabel>
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
                                  {(channels || []).map((channel) => (
                                    <option key={channel.id} value={channel.id}>
                                      #{channel.name}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Messaggio Testuale (opzionale)</FormLabel>
                                <Textarea
                                  placeholder="Use {user}, {username}, {guild}, {memberCount}"
                                  value={welcomeMessage}
                                  onChange={(e) => setWelcomeMessage(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  minH="60px"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                />
                              </FormControl>

                              <CardEditor
                                cardConfig={welcomeCard}
                                setCardConfig={setWelcomeCard}
                                isLeave={false}
                              />
                            </VStack>
                          </TabPanel>

                          <TabPanel p={0} pt={4}>
                            <VStack spacing={6} align="stretch">
                              <FormControl display="flex" alignItems="center">
                                <Checkbox
                                  isChecked={leaveEnabled}
                                  onChange={(e) => setLeaveEnabled(e.target.checked)}
                                  mr={3}
                                  colorScheme="blue"
                                  size="lg"
                                />
                                <FormLabel mb={0} fontWeight="medium" color="#ffffff">Abilita Messaggio di Uscita</FormLabel>
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Canale</FormLabel>
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
                                  {(channels || []).map((channel) => (
                                    <option key={channel.id} value={channel.id}>
                                      #{channel.name}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Messaggio Testuale (opzionale)</FormLabel>
                                <Textarea
                                  placeholder="Use {user}, {username}, {guild}, {memberCount}"
                                  value={leaveMessage}
                                  onChange={(e) => setLeaveMessage(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  minH="60px"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                />
                              </FormControl>

                              <CardEditor
                                cardConfig={leaveCard}
                                setCardConfig={setLeaveCard}
                                isLeave={true}
                              />
                            </VStack>
                          </TabPanel>
                        </TabPanels>
                      </Tabs>

                      <Divider borderColor="#36393f" />

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
                        Salva Configurazione
                      </Button>
                    </>
                  )}
                </VStack>
              </Box>

              {/* Variables Info */}
              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <Heading size="md" mb={6} color="#ffffff">
                  Variabili Disponibili
                </Heading>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{user}"}</Text>
                    <Text color="#72767d">Menzione utente (@username)</Text>
                  </Box>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{username}"}</Text>
                    <Text color="#72767d">Nome utente senza menzione</Text>
                  </Box>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{guild}"}</Text>
                    <Text color="#72767d">Nome server</Text>
                  </Box>
                  <Box bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                    <Text fontWeight="bold" color="#5865F2">{"{memberCount}"}</Text>
                    <Text color="#72767d">Numero di membri</Text>
                  </Box>
                </Grid>
              </Box>
            </VStack>
          </MotionBox>
        )}

        {activeTab === "autorole" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="#ffffff">
                  Autorole
                </Heading>
                <Text color="#72767d">Configura il ruolo da assegnare automaticamente quando un nuovo membro entra nel server</Text>
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

                  {selectedGuild && (
                    <>
                      <Divider borderColor="#36393f" />

                      <VStack spacing={6} align="stretch">
                        <FormControl display="flex" alignItems="center">
                          <Checkbox
                            isChecked={autoroleEnabled}
                            onChange={(e) => setAutoroleEnabled(e.target.checked)}
                            mr={3}
                            colorScheme="blue"
                            size="lg"
                          />
                          <FormLabel mb={0} fontWeight="medium" color="#ffffff">Abilita Autorole</FormLabel>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontWeight="bold" color="#ffffff">Ruoli da assegnare</FormLabel>
                          <Box
                            bg="#36393f"
                            border="1px"
                            borderColor="#202225"
                            borderRadius={0}
                            p={4}
                            maxH="300px"
                            overflowY="auto"
                          >
                            <VStack spacing={2} align="stretch">
                              {(roles || []).map((role) => (
                                <FormControl key={role.id} display="flex" alignItems="center">
                                  <Checkbox
                                    isChecked={autoroleRoleIds.includes(role.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAutoroleRoleIds([...autoroleRoleIds, role.id]);
                                      } else {
                                        setAutoroleRoleIds(autoroleRoleIds.filter(id => id !== role.id));
                                      }
                                    }}
                                    mr={2}
                                    colorScheme="blue"
                                    isDisabled={!selectedGuild || !autoroleEnabled}
                                  />
                                  <Text color="#ffffff">{role.name}</Text>
                                </FormControl>
                              ))}
                            </VStack>
                          </Box>
                        </FormControl>
                      </VStack>

                      <Divider borderColor="#36393f" />

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
                        Salva Configurazione Autorole
                      </Button>
                    </>
                  )}
                </VStack>
              </Box>
            </VStack>
          </MotionBox>
        )}

        {activeTab === "scheduled-messages" && (
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VStack spacing={8} align="stretch">
              <Box>
                <Heading size="2xl" mb={2} color="#ffffff">
                  Messaggi automatici
                </Heading>
                <Text color="#72767d">Configura messaggi che si ripetono automaticamente in un canale</Text>
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

                  {selectedGuild && (
                    <>
                      <Divider borderColor="#36393f" />

                      {/* Add/Edit Form */}
                      <Box>
                        <Heading size="lg" mb={4} color="#ffffff">
                          {editingScheduledMessage ? "Modifica messaggio" : "Nuovo messaggio"}
                        </Heading>
                        <VStack spacing={4} align="stretch">
                          <FormControl>
                            <FormLabel fontWeight="bold" color="#ffffff">Canale</FormLabel>
                            <Select
                              placeholder="Select a channel..."
                              value={scheduledMessageChannelId}
                              onChange={(e) => setScheduledMessageChannelId(e.target.value)}
                              bg="#36393f"
                              borderColor="#202225"
                              borderRadius={0}
                              color="#ffffff"
                              _focus={{
                                borderColor: "#5865F2",
                                boxShadow: "0 0 0 1px #5865F2",
                              }}
                            >
                              {(channels || []).map((channel) => (
                                <option key={channel.id} value={channel.id}>
                                  #{channel.name}
                                </option>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontWeight="bold" color="#ffffff">Messaggio</FormLabel>
                            <Textarea
                              placeholder="Scrivi il tuo messaggio..."
                              value={scheduledMessageText}
                              onChange={(e) => setScheduledMessageText(e.target.value)}
                              bg="#36393f"
                              borderColor="#202225"
                              borderRadius={0}
                              color="#ffffff"
                              minH="100px"
                              _focus={{
                                borderColor: "#5865F2",
                                boxShadow: "0 0 0 1px #5865F2",
                              }}
                            />
                          </FormControl>

                          <FormControl display="flex" alignItems="center">
                            <Checkbox
                              isChecked={scheduledMessageIsRecurring}
                              onChange={(e) => setScheduledMessageIsRecurring(e.target.checked)}
                              mr={3}
                              colorScheme="blue"
                            />
                            <FormLabel mb={0} fontWeight="medium" color="#ffffff">Ripeti infinitamente</FormLabel>
                          </FormControl>

                          {scheduledMessageIsRecurring && (
                            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                              <FormControl>
                                <FormLabel fontWeight="bold" color="#ffffff">Intervallo</FormLabel>
                                <Select
                                  value={scheduledMessageInterval}
                                  onChange={(e) => setScheduledMessageInterval(e.target.value)}
                                  bg="#36393f"
                                  borderColor="#202225"
                                  borderRadius={0}
                                  color="#ffffff"
                                  _focus={{
                                    borderColor: "#5865F2",
                                    boxShadow: "0 0 0 1px #5865F2",
                                  }}
                                >
                                  <option value="daily">Ogni giorno</option>
                                  <option value="weekly">Ogni settimana</option>
                                  <option value="monthly">Ogni mese</option>
                                </Select>
                              </FormControl>
                            </Grid>
                          )}

                          <FormControl display="flex" alignItems="center">
                            <Checkbox
                              isChecked={scheduledMessageEnabled}
                              onChange={(e) => setScheduledMessageEnabled(e.target.checked)}
                              mr={3}
                              colorScheme="blue"
                            />
                            <FormLabel mb={0} fontWeight="medium" color="#ffffff">Abilita messaggio</FormLabel>
                          </FormControl>

                          <Flex gap={4}>
                            <Button
                              colorScheme="blue"
                              onClick={saveScheduledMessage}
                              borderRadius={0}
                              bg="#5865F2"
                              _hover={{ bg: "#4752c4" }}
                              flex={1}
                            >
                              {editingScheduledMessage ? "Aggiorna" : "Salva"}
                            </Button>
                            {editingScheduledMessage && (
                              <Button
                                colorScheme="gray"
                                onClick={() => {
                                  setEditingScheduledMessage(null);
                                  setScheduledMessageChannelId("");
                                  setScheduledMessageText("");
                                  setScheduledMessageIsRecurring(true);
                                  setScheduledMessageInterval("daily");
                                  setScheduledMessageDays(1);
                                  setScheduledMessageEnabled(true);
                                }}
                                borderRadius={0}
                              >
                                Annulla
                              </Button>
                            )}
                          </Flex>
                        </VStack>
                      </Box>

                      <Divider borderColor="#36393f" />

                      {/* List */}
                      <Box>
                        <Heading size="lg" mb={4} color="#ffffff">
                          Messaggi salvati
                        </Heading>
                        {scheduledMessages.length === 0 ? (
                          <Text color="#72767d">Nessun messaggio automatico configurato</Text>
                        ) : (
                          <VStack spacing={3} align="stretch">
                            {scheduledMessages.map((msg) => (
                              <Box key={msg.id} bg="#36393f" p={4} borderRadius={0} border="1px" borderColor="#202225">
                                <Flex justifyContent="space-between" alignItems="start">
                                  <Box flex={1}>
                                    <Flex alignItems="center" gap={2} mb={2}>
                                      <Badge colorScheme={msg.enabled ? "green" : "red"} borderRadius={0}>
                                        {msg.enabled ? "Attivo" : "Disattivo"}
                                      </Badge>
                                      <Text color="#ffffff" fontWeight="bold">
                                        #{channels.find(c => c.id === msg.channelId)?.name || "Canale non trovato"}
                                      </Text>
                                    </Flex>
                                    <Text color="#B9BBBE" noOfLines={2}>
                                      {msg.message}
                                    </Text>
                                    {msg.isRecurring && (
                                      <Text color="#72767d" fontSize="sm" mt={2}>
                                        Ripetizione: {msg.recurrenceInterval === "daily" ? "Giornaliera" : msg.recurrenceInterval === "weekly" ? "Settimanale" : "Mensile"}
                                      </Text>
                                    )}
                                  </Box>
                                  <Flex gap={2} ml={4}>
                                    <Button
                                      size="sm"
                                      colorScheme="blue"
                                      borderRadius={0}
                                      onClick={() => {
                                        setEditingScheduledMessage(msg);
                                        setScheduledMessageChannelId(msg.channelId);
                                        setScheduledMessageText(msg.message);
                                        setScheduledMessageIsRecurring(msg.isRecurring);
                                        setScheduledMessageInterval(msg.recurrenceInterval || "daily");
                                        setScheduledMessageEnabled(msg.enabled);
                                      }}
                                    >
                                      Modifica
                                    </Button>
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      borderRadius={0}
                                      onClick={() => deleteScheduledMessage(msg.id)}
                                    >
                                      Elimina
                                    </Button>
                                  </Flex>
                                </Flex>
                              </Box>
                            ))}
                          </VStack>
                        )}
                      </Box>
                    </>
                  )}
                </VStack>
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

                  {selectedGuild && (
                    <>
                      <Divider borderColor="#36393f" />

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
                              {(channels || []).map((channel) => (
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

                      <Divider borderColor="#36393f" />

                      <Box>
                        <Heading size="md" mb={4} color="#ffffff">
                          Impostazioni TTS
                        </Heading>
                        <VStack spacing={6} align="stretch">
                          <FormControl display="flex" alignItems="center">
                            <Checkbox
                              isChecked={ttsEnabled}
                              onChange={(e) => setTtsEnabled(e.target.checked)}
                              mr={3}
                              colorScheme="blue"
                              size="lg"
                            />
                            <FormLabel mb={0} fontWeight="medium" color="#ffffff">Abilita TTS</FormLabel>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontWeight="bold" color="#ffffff">Lingua</FormLabel>
                            <Select
                              value={ttsLanguage}
                              onChange={(e) => setTtsLanguage(e.target.value)}
                              bg="#36393f"
                              borderColor="#202225"
                              borderRadius={0}
                              color="#ffffff"
                              _focus={{
                                borderColor: "#5865F2",
                                boxShadow: "0 0 0 1px #5865F2",
                              }}
                            >
                              <option value="it">Italiano</option>
                              <option value="en">Inglese</option>
                              <option value="es">Spagnolo</option>
                              <option value="fr">Francese</option>
                              <option value="de">Tedesco</option>
                            </Select>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontWeight="bold" color="#ffffff">
                              Prefissi (separati da virgola)
                            </FormLabel>
                            <Input
                              value={ttsPrefixes.join(", ")}
                              onChange={(e) => setTtsPrefixes(e.target.value.split(",").map(p => p.trim()).filter(p => p))}
                              bg="#36393f"
                              borderColor="#202225"
                              borderRadius={0}
                              color="#ffffff"
                              placeholder=", ; !"
                              _focus={{
                                borderColor: "#5865F2",
                                boxShadow: "0 0 0 1px #5865F2",
                              }}
                            />
                          </FormControl>
                        </VStack>
                      </Box>

                      <Divider borderColor="#36393f" />

                      <Button
                        colorScheme="blue"
                        onClick={saveTTSConfig}
                        size="lg"
                        borderRadius={0}
                        bg="#5865F2"
                        _hover={{
                          bg: "#4752c4",
                        }}
                      >
                        Salva Configurazione TTS
                      </Button>
                    </>
                  )}
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
                  Impostazioni
                </Heading>
                <Text color="#72767d">Configura le impostazioni generali</Text>
              </Box>

              <Box bg="#2f3136" p={8} borderRadius={0} border="1px" borderColor="#202225">
                <Text color="#72767d">Nessuna impostazione disponibile al momento.</Text>
              </Box>
            </VStack>
          </MotionBox>
        )}
      </Box>
    </Flex>
  );
}
