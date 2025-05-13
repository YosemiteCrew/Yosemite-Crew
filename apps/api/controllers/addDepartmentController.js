const Department = require('../models/AddDepartment');
const AWS = require('aws-sdk');
const { DepartmentFromFHIRConverter } = require('../utils/DepartmentFhirHandler');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const AddDepartmentController = {
  addDepartment: async (req, res) => {

    const data = new DepartmentFromFHIRConverter(req.body).toCustomFormat()

    try {
      const newDepartment = new Department({
        departmentName: data.departmentName,
        bussinessId: data.bussinessId,
        description: data.description,
        email: data.email,
        phone: data.phone,
        countrycode: data.countrycode,
        services: data.services,
        departmentHeadId: data.departmentHeadId,
        // operatingHours: data.operatingHours,
        consultationModes: data.consultationModes,
        conditionsTreated: data.conditionsTreated,
      });

     const response =  await newDepartment.save();

      if(response){
        res.status(201).json(newDepartment);
      }
    } catch (error) {
      console.error('Error creating department:', error);
      res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            diagnostics: error.message,
          },
        ],
      });
    }
  },
  getAddDepartment: async (req, res) => {
    try {
      const { userId } = req.query;

      if (typeof userId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: 'Invalid doctorId format' });
      }
      

      const departments = await Department.find({ bussinessId: userId }).select(
        '_id departmentName'
      );
      if (!departments || departments.length === 0) {
        return res.status(404).json({ message: 'No departments found' });
      } else {
        res.status(200).json(departments);
      }
    } catch (error) {
     
      res.status(500).json({ message: error.message });
    }
  },
  uploadimage: async (req, res) => {
   try {
    const {image} = req.files
    const uploadToS3 = (file, folderName) => {
      return new Promise((resolve, reject) => {
        const params = {
          Bucket: 'yosemitecrew-website',
          Key: `${folderName}/${Date.now()}_${file.name}`,
          Body: file.data,
          ContentType: file.mimetype,
        };

        s3.upload(params, (err, data) => {
          if (err) {
            console.error('Error uploading to S3:', err);
            reject(err);
          } else {
            resolve(data.Key);
          }
        });
      });
    };
   const data =  await uploadToS3(image, 'images');
   res.status(200).json(data)
   } catch (error) {
    console.log("error", error);
   }
  }
  
};

module.exports = AddDepartmentController;
