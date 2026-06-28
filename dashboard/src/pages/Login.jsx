import React, { useEffect } from "react";
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
  Center,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { getDiscordAuthUrl, setAccessToken } from "../config/discord";

export default function Login() {
  const toast = useToast();

  useEffect(() => {
    // Check if we're in the callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      handleCallback(code);
    }
  }, []);

  const handleCallback = async (code) => {
    try {
      // Exchange code for token via backend
      const res = await fetch("/api/auth/discord/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error("Failed to authenticate");

      const data = await res.json();
      setAccessToken(data.access_token);

      // Redirect to dashboard
      window.location.href = "/";
    } catch (err) {
      console.error("Auth error:", err);
      toast({
        title: "Authentication Failed",
        description: "Could not authenticate with Discord",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleLogin = () => {
    window.location.href = getDiscordAuthUrl();
  };

  return (
    <Box bg="gray.900" minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <Container maxW="md">
        <Center>
          <VStack spacing={8} textAlign="center">
            <Box>
              <Heading size="2xl" mb={2} color="white">
                🤖 Ade Dashboard
              </Heading>
              <Text color="gray.400" fontSize="lg">
                Manage your Discord bot settings
              </Text>
            </Box>

            <Box bg="gray.800" p={8} borderRadius="lg" w="full">
              <VStack spacing={6}>
                <Box>
                  <Text color="gray.300" mb={4}>
                    Sign in with your Discord account to get started
                  </Text>
                </Box>

                <Button
                  onClick={handleLogin}
                  bg="#5865F2"
                  color="white"
                  _hover={{ bg: "#4752C4" }}
                  size="lg"
                  w="full"
                  fontWeight="bold"
                >
                  Login with Discord
                </Button>

                <Text color="gray.500" fontSize="sm">
                  We only access your basic info and server list
                </Text>
              </VStack>
            </Box>
          </VStack>
        </Center>
      </Container>
    </Box>
  );
}

