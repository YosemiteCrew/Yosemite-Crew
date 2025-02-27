const mongoose = require('mongoose');
const visibleProfileSchema = new mongoose.Schema({
  hospitalId: {
    type: String,
    required: true,
  },
  facility: {
    type: Array,
  },
  department: {
    type: Array,
  },
  services: {
    type: Array,
  },
  images: {
    type: Array,
  },
});
const ProfileVisibility = mongoose.model(
  'ProfileVisibility',
  visibleProfileSchema
);
module.exports = ProfileVisibility;
