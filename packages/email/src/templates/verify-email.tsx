import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface VerifyEmailProps {
  verifyUrl: string;
}

export function VerifyEmail({ verifyUrl }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address for Fable</Preview>
      <Body
        style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5" }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "40px auto",
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: 32,
          }}
        >
          <Text style={{ fontSize: 16, color: "#111" }}>
            Click the button below to verify your email address.
          </Text>
          <Button
            href={verifyUrl}
            style={{
              backgroundColor: "#111",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            Verify email
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
