import axios from 'axios';


const BASE_URL = import.meta.env.VITE_BASE_URL; // Replace with your API URL
const token = sessionStorage.getItem('token');

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
     Authorization: `Bearer ${token}`
  },
});

export const getData = async (endpoint) => {
  try {
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    console.error('API getData error:', error);
    throw error;
  }
};

export const postData = async (endpoint, data) => {
  try {
    const response = await api.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error('API postData error:', error);
    throw error;
  }
};
