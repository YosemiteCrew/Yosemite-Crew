// eslint-disable-next-line no-unused-vars
import React, { useState } from 'react';
import './ChatApp.css';

const ChatApp = () => {
  // Initial messages with a video type
  const [messages, setMessages] = useState([
    {
      sender: 'Sky B',
      time: '11:01',
      content: "Hi Dr. Brown, Kizie's been limping slightly on her right leg for a few days now. She doesn't seem to be in a lot of pain, but it worries me.",
      type: 'text',
    },
    {
      sender: 'Sky B',
      content: 'https://example.com/dog-video.mp4', // Example video URL
      type: 'video',
      time: '11:01',
    },
    {
      sender: 'You',
      time: '11:03',
      content: 'Thanks for letting me know. Has she had any recent injuries or been more active than usual?',
      type: 'text',
    },
    {
      sender: 'Sky B',
      time: '16:46',
      content: 'No injuries, but we did go on a couple of long hikes last week. She’s been more tired than usual too.',
      type: 'text',
    },
  ]);

  const [newMessage, setNewMessage] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false); // For toggling the visibility of inputs

  // Add a new text message
  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      const messageObj = {
        sender: 'You',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: newMessage,
        type: 'text',
      };
      setMessages([...messages, messageObj]);
      setNewMessage(''); // Clear input
    }
  };

  // Add a new video message
  const sendVideo = (e) => {
    const file = e.target.files[0];
    if (file) {
      const videoUrl = URL.createObjectURL(file);
      const messageObj = {
        sender: 'You',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: videoUrl,
        type: 'video',
      };
      setMessages([...messages, messageObj]);
      e.target.value = null; // Reset input
    }
  };

  // Add a new image message
  const sendImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const messageObj = {
        sender: 'You',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: imageUrl,
        type: 'image',
      };
      setMessages([...messages, messageObj]);
      e.target.value = null; // Reset input
    }
  };

  // Add a new document message
  const sendDocument = (e) => {
    const file = e.target.files[0];
    if (file) {
      const documentUrl = URL.createObjectURL(file);
      const messageObj = {
        sender: 'You',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: documentUrl,
        type: 'document',
        name: file.name, // Store the file name
      };
      setMessages([...messages, messageObj]);
      e.target.value = null; // Reset input
    }
  };

  // Toggle image, video, and document input visibility
  const toggleInputVisibility = () => {
    setIsInputVisible(!isInputVisible);
  };

  return (
    
      <div className="ChatAppData">
        <div className="ChatName">
          <h5>Chat with Sky B</h5>
        </div>

        <div className="ChatApp_container">
          <div className="Chatmessages mostly_scrollbar">
            {messages.map((msg, index) => (
              <div key={index} className={`message  ${msg.sender === 'You' ? 'you-message' : 'other-message'}`}>
                {msg.type === 'text' && (
                  <>
                    <h6>{msg.sender}</h6>
                    <p>{msg.content}</p>
                  </>
                )}

                {msg.type === 'image' && (
                  <img src={msg.content} alt="Sent content" style={{ maxWidth: '200px' }} />
                )}

                {msg.type === 'video' && (
                  <video controls style={{ maxWidth: '200px' }}>
                    <source src={msg.content} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}

                {msg.type === 'document' && (
                  <a href={msg.content} target="_blank" rel="noopener noreferrer">{msg.name}</a>
                )}

                <p className="time">{msg.time}</p>
              </div>
            ))}
          </div>

          <div className="ChatAppBootom">
            <div className="Addicon">
                {/* Single toggle for all inputs */}
                <a href="#" onClick={toggleInputVisibility}>
                    <i className="ri-add-circle-line"></i>
                </a>
                <div className= {`AddinputDiv ${isInputVisible ? 'show' : ''}`}>
                    {/* Video, image, and document inputs, conditionally rendered */}
                    {isInputVisible && (
                    <>
                        <div className="Addp-input">
                            <div className="uplinner">
                                <i className="ri-video-fill"></i>
                                <p>Send an Video</p>
                            </div>
                        {/* <label htmlFor="video-upload">Send a Video</label> */}
                        <input type="file" id="video-upload" accept="video/*" onChange={sendVideo} />
                        </div>
                        <div className="Addp-input">
                            <div className="uplinner">
                                <i className="ri-image-line"></i>
                                <p>Send an Image</p>
                            </div>
                        {/* <label htmlFor="image-upload">Send an Image</label> */}
                        <input type="file" id="image-upload" accept="image/*" onChange={sendImage} />
                        </div>
                        <div className="Addp-input">
                            <div className="uplinner">
                                <i className="ri-file-line"></i>
                                <p>Send a Document</p>
                            </div>
                        {/* <label htmlFor="document-upload">Send a Document</label> */}
                        <input type="file" id="document-upload" accept=".pdf,.doc,.docx" onChange={sendDocument} />
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
            <button onClick={sendMessage}><i className="ri-arrow-right-line"></i></button>
          </div>
        </div>

        <div className="EndBtn">
          <a href="#"><i className="ri-close-circle-fill"></i> End Chat</a>
        </div>




      </div>
  
  );
};

export default ChatApp;
