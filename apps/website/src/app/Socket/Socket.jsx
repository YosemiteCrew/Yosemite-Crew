// src/socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
  withCredentials: true,
});

export default socket;