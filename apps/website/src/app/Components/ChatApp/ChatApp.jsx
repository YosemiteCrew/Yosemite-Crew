import React, { useCallback, useEffect, useState, useRef } from 'react';
import './ChatApp.css';
import socket from '../../Socket/Socket';
import { useAuth } from '../../context/useAuth';
import axios from 'axios';
import { HiDocumentArrowDown } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';

const ChatApp = () => {
  const { userId, onLogout } = useAuth();
  const navigate = useNavigate();
  const receiver =
    userId === '83e4a8e2-0091-705b-0924-c1556541be19'
      ? 'a3b40812-7031-706e-043e-9f3787f70356'
      : '83e4a8e2-0091-705b-0924-c1556541be19';

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messagesContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true); // Track if user is at the bottom

  const getMessages = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NX_PUBLIC_VITE_BASE_URL}api/hospitals/getMessages?senderId=${userId}&receiverId=${receiver}&page=${page}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response) {
        const newMessages = response.data.messages.reverse(); // Reverse to show latest messages at the bottom
        setMessages((prevMessages) => [...newMessages, ...prevMessages]); // Keeps order correct
        setHasMore(response.data.hasMore); // Update hasMore state
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Session expired. Redirecting to signin...');
        onLogout(navigate);
      }
    }
  }, [userId, receiver, page, navigate, onLogout]);

  useEffect(() => {
    if (userId) {
      getMessages();
    }
  }, [userId, getMessages]);

  useEffect(() => {
    if (userId) {
      socket.emit('userOnline', userId);
    }
  }, [userId]);

  useEffect(() => {
    const handleReceiveMessage = (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    };
    socket.on('receivePrivateMessage', handleReceiveMessage);
    return () => socket.off('receivePrivateMessage', handleReceiveMessage);
  }, []);

  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      const messageObj = {
        sender: userId,
        receiver,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        content: newMessage,
        type: 'text',
      };
      socket.emit('sendPrivateMessage', messageObj);
      setNewMessage('');
    }
  };

  const sendFile = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const messageObj = {
          sender: userId,
          receiver,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          content: '',
          type,
          file: {
            originalname: file.name,
            mimetype: file.type,
            buffer: event.target.result,
          },
        };
        socket.emit('sendPrivateMessage', messageObj);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const loadMoreMessages = useCallback(() => {
    if (hasMore) {
      setPage((prevPage) => prevPage + 1); // Increment page to fetch older messages
    }
  }, [hasMore]);

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight);
      if (scrollTop === 0 && hasMore) {
        loadMoreMessages();
      }
    }
  }, [hasMore, loadMoreMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
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
        <div
          className="Chatmessages mostly_scrollbar"
          ref={messagesContainerRef}
          style={{ overflowY: 'auto' }} // Adjust height as needed
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.sender === userId ? 'you-message' : 'other-message'
              }`}
            >
              {msg.type === 'text' && (
                <>
                  <h6>{msg.sender === userId ? 'You' : null}</h6>
                  <p>{msg.content}</p>
                </>
              )}
              {msg.type === 'image' && (
                <>
                  <h6>{msg.sender === userId ? 'You' : null}</h6>
                  <img
                    src={msg.fileUrl}
                    alt="Sent content"
                    style={{ maxWidth: '200px' }}
                  />
                </>
              )}
              {msg.type === 'video' && (
                <>
                  <h6>{msg.sender === userId ? 'You' : null}</h6>
                  <video controls style={{ maxWidth: '200px' }}>
                    <source src={msg.fileUrl} type="video/mp4" />
                  </video>
                </>
              )}
              {msg.type === 'document' && msg.fileUrl && (
                <>
                  <h6>{msg.sender === userId ? 'You' : null}</h6>
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={msg.fileName || 'document'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '12px',
                      color: '#302f2e',
                      textDecoration: 'underline',
                    }}
                  >
                    <HiDocumentArrowDown style={{ marginRight: '5px' }} />
                    {msg.fileName || 'Download File'}
                  </a>
                </>
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
            <p onClick={() => setIsInputVisible(!isInputVisible)}>
              <i className="ri-add-circle-line"></i>
            </p>
            <div className={`AddinputDiv ${isInputVisible ? 'show' : ''}`}>
              {isInputVisible && (
                <>
                  <div className="Addp-input">
                    <div className="uplinner">
                      <i className="ri-video-fill"></i>
                      <p>Send a Video</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => sendFile(e, 'video')}
                    />
                  </div>

                  <div className="Addp-input">
                    <div className="uplinner">
                      <i className="ri-image-line"></i>
                      <p>Send an Image</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => sendFile(e, 'image')}
                    />
                  </div>

                  <div className="Addp-input">
                    <div className="uplinner">
                      <i className="ri-file-line"></i>
                      <p>Send a Document</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => sendFile(e, 'document')}
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
          <button onClick={sendMessage}>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
      <div className="EndBtn">
        <p>
          <i className="ri-close-circle-fill"></i> End Chat
        </p>
      </div>
    </div>
  );
};

export default ChatApp;
