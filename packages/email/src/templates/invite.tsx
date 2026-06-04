import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface InviteEmailProps {
  inviterName: string;
  orgName: string;
  inviteUrl: string;
}

export function InviteEmail({ inviterName, orgName, inviteUrl }: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {orgName} on Fable
      </Preview>
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
            {inviterName} has invited you to join <strong>{orgName}</strong>{" "}
            on Fable.
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={inviteUrl}
              style={{
                backgroundColor: "#111",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              Accept invite
            </Button>
          </Section>
          <Hr style={{ borderColor: "#e5e5e5" }} />
          <Text style={{ fontSize: 12, color: "#888" }}>
            If you did not expect this invitation, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
