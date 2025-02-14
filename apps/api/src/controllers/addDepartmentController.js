const Department = require('../models/AddDepartment');

const AddDepartmentController = {
  addDepartment: async (req, res) => {
    console.log(JSON.stringify(req.body.operatingHours, null, 2));

    try {
      const newDepartment = new Department({
        departmentName: req.body.departmentName,
        bussinessId: req.body.bussinessId,
        description: req.body.description,
        email: req.body.email,
        phone: req.body.phone,
        countrycode: req.body.countrycode,
        services: req.body.services,
        departmentHeadId: req.body.departmentHeadId,
        // operatingHours: req.body.operatingHours,
        consultationModes: req.body.consultationModes,
        conditionsTreated: req.body.conditionsTreated,
      });

      await newDepartment.save();

      res.status(201).json(newDepartment);
    } catch (error) {
      console.error('Error creating department:', error);
      res.status(400).json({ message: error.message });
    }
  },
  getAddDepartment: async (req, res) => {
    try {
      const { userId } = req.query;
      console.log('userId', userId);
      const departments = await Department.find({ bussinessId: userId }).select(
        '_id departmentName'
      );
      if (!departments || departments.length === 0) {
        return res.status(404).json({ message: 'No departments found' });
      } else {
        res.status(200).json(departments);
      }
    } catch (error) {
      console.error('Error getting departments:', error);
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = AddDepartmentController;
