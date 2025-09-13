"use client";
import React, { useCallback, useEffect, useState, useRef } from "react";
import "./MobChatApp.css";
import { Socket, io } from "socket.io-client";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";

// Initialize socket instance
const socket: Socket = io(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");

interface Message {
  sender: string|null;
  receiver: string;
  time: string;
  content: string;
  type: "text" | "image" | "video" | "document";
  file?: {
    originalname: string;
    mimetype: string;
    buffer: ArrayBuffer;
  };
  fileUrl?: string;
  fileName?: string;
}

const MobChatApp: React.FC = () => {
  const { userId } = useOldAuthStore();
  const router = useRouter();

  const receiver: string =
    userId === "c3e4a8d2-80e1-7065-09e1-8c6db4e36757"
      ? "4334c802-f0d1-70c2-f67e-65998fa0148b"
      : "c3e4a8d2-80e1-7065-09e1-8c6db4e36757";

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [isInputVisible, setIsInputVisible] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  // Fallback logout handler
  const onLogout = useCallback(() => {
    sessionStorage.clear();
    router.push("/signin");
  }, [router]);

  const getMessages = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get<{
        messages: Message[];
        hasMore: boolean;
      }>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/hospitals/getMessages?senderId=${userId}&receiverId=${receiver}&page=${page}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        const newMessages = response.data.messages.reverse();
        setMessages((prevMessages) => [...newMessages, ...prevMessages]);
        setHasMore(response.data.hasMore);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log("Session expired. Redirecting to signin...");
        onLogout();
      }
    }
  }, [userId, receiver, page, onLogout]);

  useEffect((): void => {
    if (userId) {
      getMessages();
    }
  }, [userId, getMessages]);

  useEffect((): void => {
    if (userId) {
      socket.emit("userOnline", userId);
    }
  }, [userId]);

  useEffect(() => {
    const handleReceiveMessage = (data: Message) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    };
    socket.on("receivePrivateMessage", handleReceiveMessage);
    return () => {
      socket.off("receivePrivateMessage", handleReceiveMessage);
    };
  }, []);

  const sendMessage = () => {
    if (newMessage.trim() !== "") {
      const messageObj: Message = {
        sender: userId,
        receiver,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        content: newMessage,
        type: "text",
      };
      socket.emit("sendPrivateMessage", messageObj);
      setNewMessage("");
    }
  };

  const sendFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "video" | "document"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const messageObj: Message = {
          sender: userId,
          receiver,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          content: "",
          type,
          file: {
            originalname: file.name,
            mimetype: file.type,
            buffer: event.target?.result as ArrayBuffer,
          },
        };
        socket.emit("sendPrivateMessage", messageObj);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const loadMoreMessages = useCallback(() => {
    if (hasMore) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [hasMore]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 20);
      if (scrollTop === 0 && hasMore) {
        loadMoreMessages();
      }
    }
  }, [hasMore, loadMoreMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  return (
    <div className="ChatAppData">
      <div className="ChatName">
        <h5>Chat with Sky B</h5>
      </div>
      <div className="ChatApp_container">
        <div className="Chatmessages mostly_scrollbar" ref={messagesContainerRef}>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.sender === userId ? "you-message" : "other-message"
              }`}
            >
              <h6>{msg.sender === userId ? "You" : null}</h6>

              {msg.type === "text" && <p>{msg.content}</p>}

              {msg.type === "image" && msg.fileUrl && (
                <img src={msg.fileUrl} alt="sent" />
              )}

              {msg.type === "video" && msg.fileUrl && (
                <video controls>
                  <source src={msg.fileUrl} type="video/mp4" />
                </video>
              )}

              {msg.type === "document" && msg.fileUrl && (
                <a
                  href={msg.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={msg.fileName || "document"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "12px",
                    color: "#302f2e",
                    textDecoration: "underline",
                  }}
                >
                  {msg.fileName || "Download File"}
                </a>
              )}

              <p className="time">{msg.time}</p>
            </div>
          ))}

          {hasMore && (
            <div className="loading-more">
              <p>Loading...</p>
            </div>
          )}
        </div>

        <div className="ChatAppBootom">
          <div className="Addicon">
            <p onClick={() => setIsInputVisible(!isInputVisible)}></p>
            <div className={`AddinputDiv ${isInputVisible ? "show" : ""}`}>
              {isInputVisible && (
                <>
                  <div className="Addp-input">
                    <div className="uplinner">
                      <p>Send a Video</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => sendFile(e, "video")}
                    />
                  </div>

                  <div className="Addp-input">
                    <div className="uplinner">
                      <p>Send an Image</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => sendFile(e, "image")}
                    />
                  </div>

                  <div className="Addp-input">
                    <div className="uplinner">
                      <p>Send a Document</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => sendFile(e, "document")}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
            />
          </div>
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
      <div className="EndBtn">
        <p>End Chat</p>
      </div>
    </div>
  );
};

export default MobChatApp;