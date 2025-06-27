"use client";

import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  InputGroup,
  Button,
  Badge,
} from "react-bootstrap";
import "./ChatApp.css";
import Image from "next/image";

interface Message {
  sender: "me" | "them";
  text: string;
  time: string;
}

interface ChatUser {
  name: string;
  preview: string;
  avatar: string;
  time: string;
  unread?: boolean;
}

const petUnread: ChatUser[] = [
  {
    name: "Emily Foster",
    preview: "Can I reschedule Oscar’s vaccination to next week?",
    avatar: "/Images/user1.png",
    time: "10m",
    unread: true,
  },
  {
    name: "Henry Scott",
    preview: "I think my cat might have a fever. What should I do?",
    avatar: "/Images/user2.png",
    time: "30m",
    unread: true,
  },
];

const petOld: ChatUser[] = [
  {
    name: "Sky B",
    preview: "No injuries, but we did go on a couple of long hikes...",
    avatar: "/Images/user3.png",
    time: "6h",
  },
  {
    name: "Adam Price",
    preview: "Could you please share the medical report for Bruno?",
    avatar: "/Images/user4.png",
    time: "1d",
  },
];

const teamUnread: ChatUser[] = [
  {
    name: "Dr. Emily Foster",
    preview: "Please confirm the schedule for the surgeries tomorrow.",
    avatar: "/Images/doc1.png",
    time: "10m",
    unread: true,
  },
  {
    name: "Dr. Henry Scott",
    preview: "Can you check if the test results for Max’s bloodwork...",
    avatar: "/Images/doc2.png",
    time: "30m",
    unread: true,
  },
];

const teamOld: ChatUser[] = [
  {
    name: "Dr. Patrick Henry",
    preview: "The X-ray machine in Room 3 is malfunctioning again...",
    avatar: "/Images/doc3.png",
    time: "6h",
  },
  {
    name: "Dr. Adam Price",
    preview: "The supply of anesthetics is running low...",
    avatar: "/Images/doc4.png",
    time: "1d",
  },
  {
    name: "Dr. Sarah Thompson",
    preview: "Just a heads-up: I’ll be late for the 2...",
    avatar: "/Images/doc5.png",
    time: "2d",
  },
];

const ChatApp: React.FC = () => {
  const [isTeamChat, setIsTeamChat] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "them",
      text: isTeamChat
        ? "The X-ray machine in Room 3 is malfunctioning again."
        : "Hi Dr. Brown, Kizie’s been limping slightly...",
      time: "11:03 AM",
    },
    {
      sender: "me",
      text: "Got it. If there’s anything you need assistance with, let me know.",
      time: "11:05 AM",
    },
  ]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    const newMsg: Message = {
      sender: "me",
      text: chatInput,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  const toggleChat = () => {
    setIsTeamChat((prev) => !prev);
    setMessages([]);
  };

  const unreadChats = isTeamChat ? teamUnread : petUnread;
  const oldChats = isTeamChat ? teamOld : petOld;

  return (
    <>
      <section className="ChatAppSection">
        <Container>
          <Row className="chat-container">

            {/* Sidebar */}
            <Col md={3} className="chat-sidebar">
              <h5 className="chat-title">
                {isTeamChat ? "Team Chat" : "Pet Chat"}
              </h5>
              <InputGroup className="mb-3">
                <Form.Control placeholder="Search to chat" />
              </InputGroup>

              <div className="chat-tabs mb-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="me-2 active"
                >
                  Active
                </Button>
                <Button variant="outline-secondary" size="sm" className="me-2">
                  Archived
                </Button>
                <Button variant="outline-secondary" size="sm">
                  Completed
                </Button>
              </div>

              <div>
                <div className="chat-section-title">Unread Messages</div>
                {unreadChats.map((chat, idx) => (
                  <div key={idx} className="chat-item">
                    <img src={chat.avatar} className="avatar" />
                    <div className="chat-info">
                      <div className="chat-name">{chat.name}</div>
                      <div className="chat-preview">
                        {chat.preview}
                        <span className="chat-time">{chat.time}</span>
                        <span className="dot" />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="chat-section-title mt-3">Old Messages</div>
                {oldChats.map((chat, idx) => (
                  <div key={idx} className="chat-item">
                    <img src={chat.avatar} className="avatar" />
                    <div className="chat-info">
                      <div className="chat-name">{chat.name}</div>
                      <div className="chat-preview">
                        {chat.preview}
                        <span className="chat-time">{chat.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Col>

            {/* Main Chat Window */}
            <Col md={9} className="chat-window">
              <div className="chat-header-top d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <Image src="/Images/doctor.png" className="avatar" width={150} height={150} />
                  <strong className="ms-2">
                    {isTeamChat ? "Dr. Patrick Henry" : "Sky B"}
                  </strong>
                  <Badge bg="success" className="ms-2">
                    Online
                  </Badge>
                </div>
                <Button size="sm" variant="dark" onClick={toggleChat}>
                  {isTeamChat ? "Switch to Pet Chat" : "Switch to Team Chat"}
                </Button>
              </div>

              <div className="chat-body">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`chat-bubble-wrapper ${msg.sender === "me" ? "sent" : "received"}`}
                  >
                    <div className={`chat-bubble ${msg.sender}`}>
                      <p>{msg.text}</p>
                      <span className="chat-time">{msg.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <InputGroup className="chat-input">
                <Form.Control
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend}>Send</Button>
              </InputGroup>
            </Col>


          </Row>
        </Container>
      </section>
    </>
  );
};

export default ChatApp;
