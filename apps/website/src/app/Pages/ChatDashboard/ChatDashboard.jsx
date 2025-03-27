
import React, { useState } from 'react';
import { Line } from 'react-chartjs-2'; // Assuming Chart.js for the chart

const ChatDashboard = () => {
  const [conversations] = useState([
    { name: 'Dr. Emily Foster', image: '/user1.jpg', lastMessage: 'Please confirm the schedule...', time: '10m' },
    { name: 'Dr. Henry Scott', image: '/user2.jpg', lastMessage: 'Can you check the test results...', time: '30m' },
    { name: 'Dr. Patrick Henry', image: '/user3.jpg', lastMessage: 'The X-ray machine in Room 3...', time: '6h' },
  ]);

  const [selectedUser, setSelectedUser] = useState(conversations[0]);
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I help?', time: '11:03', isSent: false },
    { text: 'I need help with an X-ray issue.', time: '11:04', isSent: true },
  ]);

  const handleSendMessage = (text) => {
    setMessages([...messages, { text, time: new Date().toLocaleTimeString(), isSent: true }]);
  };

  const chartData = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June'],
    datasets: [
      {
        label: 'Performance',
        data: [10, 20, 30, 40, 50, 60],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
    },
  };

  return (
    <div style={styles.dashboard}>
      {/* Chart Section */}
      <div style={styles.chartSection}>
        <h3>Performance Chart</h3>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Chat List Section */}
      <div style={styles.chatListSection}>
        <h3>Messages</h3>
        <input type="text" placeholder="Search people" style={styles.searchBar} />
        <div style={styles.chatList}>
          {conversations.map((user, index) => (
            <div
              key={index}
              style={{
                ...styles.chatItem,
                backgroundColor: selectedUser.name === user.name ? '#f1f1f1' : 'transparent',
              }}
              onClick={() => setSelectedUser(user)}
            >
              <img src={user.image} alt={user.name} style={styles.userAvatar} />
              <div>
                <h4>{user.name}</h4>
                <p>{user.lastMessage}</p>
              </div>
              <span>{user.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Conversation Section */}
      <div style={styles.chatConversationSection}>
        <header style={styles.chatHeader}>
          <img src={selectedUser.image} alt={selectedUser.name} style={styles.userAvatar} />
          <h3>{selectedUser.name}</h3>
          <span style={styles.onlineStatus}>Online</span>
        </header>
        <div style={styles.chatMessages}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.chatMessage,
                alignSelf: msg.isSent ? 'flex-end' : 'flex-start',
                backgroundColor: msg.isSent ? '#dcf8c6' : '#ffffff',
              }}
            >
              <p>{msg.text}</p>
              <span style={styles.chatTime}>{msg.time}</span>
            </div>
          ))}
        </div>
        <div style={styles.messageInput}>
          <input
            type="text"
            placeholder="Type your message..."
            style={styles.inputField}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                handleSendMessage(e.target.value);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatDashboard;

const styles = {
  dashboard: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Arial, sans-serif',
  },
  chartSection: {
    flex: 1,
    padding: '20px',
    borderRight: '1px solid #ddd',
    overflowY: 'auto',
  },
  chatListSection: {
    flex: 1.5,
    padding: '20px',
    borderRight: '1px solid #ddd',
    overflowY: 'auto',
  },
  chatConversationSection: {
    flex: 2.5,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
  },
  searchBar: {
    width: '100%',
    padding: '10px',
    marginBottom: '20px',
    borderRadius: '5px',
    border: '1px solid #ddd',
  },
  chatList: {
    display: 'flex',
    flexDirection: 'column',
  },
  chatItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    marginRight: '10px',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
  },
  onlineStatus: {
    marginLeft: 'auto',
    color: 'green',
  },
  chatMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
  },
  chatMessage: {
    maxWidth: '70%',
    padding: '10px',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  chatTime: {
    fontSize: '12px',
    color: '#888',
    marginTop: '5px',
  },
  messageInput: {
    marginTop: '20px',
  },
  inputField: {
    width: '100%',
    padding: '10px',
    borderRadius: '5px',
    border: '1px solid #ddd',
  },
};
