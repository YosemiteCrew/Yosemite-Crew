import React, { useState } from 'react';
import { Modal, Button, Form, Row, Col, Tab, Tabs, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { FaTimes, FaCloudUploadAlt, FaSearch } from 'react-icons/fa';
import './TaskModal.css';
import { FormInput } from '@/app/Pages/Sign/SignUp';
import DynamicDatePicker from '../DynamicDatePicker/DynamicDatePicker';
import DynamicSelect from '../DynamicSelect/DynamicSelect';

interface TaskModalProps {
  show: boolean;
  onHide: () => void;
  mode: 'create' | 'edit';
  taskData?: any;
  selectedDate?: Date;
  selectedTime?: string;
}

const TaskModal: React.FC<TaskModalProps> = ({ 



  show, 
  onHide, 
  mode, 
  taskData, 
  selectedDate, 
  selectedTime 
}) => {
  const [activeTab, setActiveTab] = useState('task');
  //emails
  const [email, setEmail] = useState("")
  const [formData, setFormData] = useState({
    taskTitle: taskData?.taskTitle || 'Medical Documents',
    taskCategory: taskData?.taskCategory || '',
    description: taskData?.description || '',
    priority: taskData?.priority || 'High Priority',
    date: selectedDate ? selectedDate.toISOString().split('T')[0] : '2025-05-05',
    endDate: taskData?.endDate || '',
    assignedTo: taskData?.assignedTo || '',
    assignedDepartment: taskData?.assignedDepartment || '',
    isAppointmentBased: taskData?.isAppointmentBased || 'Yes',
    patientName: taskData?.patientName || '',
    parentName: taskData?.parentName || '',
    appointmentId: taskData?.appointmentId || '',
    taskStatus: taskData?.taskStatus || 'Task Accepted'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    // Handle form submission
    console.log('Form data:', formData);
    onHide();
  };
  
  const [name, setName] = useState({
    dateOfBirth: "",
  });
  const handleDateChange = (date: string | null) => {
    setName((prevData) => ({
      ...prevData,
      dateOfBirth: date || "",
    }));
  };


  const taskStatuses = ['Task Accepted', 'In Progress', 'Completed', 'Cancelled'];

  type Option = {
    value: string;
    label: string;
  };
  const areaOptions: Option[] = [
    { value: "north", label: "Internal Medicine" },
    { value: "south", label: "Surgery" },
    { value: "east", label: "Emergency" },
    { value: "west", label: "Dermatology" }
  ];
  const assignto: Option[] = [
    { value: "north", label: "Dr. James Wilson" },
    { value: "south", label: "Dr. Laura Evans" },
    { value: "east", label: "Dr. Emily Foster" },
  ];
  const priorities: Option[] = [
    { value: "north", label: "High Priority" },
    { value: "south", label: "Medium Priority" },
    { value: "east", label: "Low Priority" },
  ];

  return (
    <Modal show={show} onHide={onHide} size="lg" className="task-modal">
      <Modal.Header className="modal-header">
        <div className="modal-tabs">
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'task')}
            className="custom-tabs"
          >
            <Tab eventKey="task" title="Create Task" />
            <Tab eventKey="appointment" title="Create Appointment" />
          </Tabs>
        </div>
        <Button variant="link" onClick={onHide} className="close-btn">
          <FaTimes />
        </Button>
      </Modal.Header>

      <Modal.Body className="modal-body">

        <Tabs
            defaultActiveKey="createtask"
            id="fill-tab-example"
            className="mb-3"
            fill
          >
            <Tab eventKey="createtask" title="Create Task">

              <div className="CreateTaskModal">
                <Form>

                  <div className="TaskDetailDiv">
                    <h6>Task Detail</h6>
                    <Row>
                      <Col md={6}>
                        <FormInput readonly={false} intype="text" inname="taskTitle" value={formData.taskTitle} inlabel="Task Title" onChange={(e) => handleInputChange('taskTitle', e.target.value)} />
                      </Col>
                      <Col md={6}>
                        <FormInput readonly={false} intype="text" inname="taskTitle" value={formData.taskCategory} inlabel="Task Category" onChange={(e) => handleInputChange('taskCategory', e.target.value)} />
                      </Col>
                    </Row>
                    <Row>
                      <Col md={12}>
                        <FormInput readonly={false} intype="text" inname="taskTitle" value={formData.description} inlabel="Description" onChange={(e) => handleInputChange('description', e.target.value)} />
                      </Col>
                    </Row>
                    <div className="dd">
                      <h6>Timing and Priority</h6>
                      <DynamicSelect
                        options={priorities}
                        value={formData.assignedDepartment}
                        onChange={(selectedOption) =>
                          handleInputChange("assignedDepartment", selectedOption)
                        }
                        inname="HighPriority"
                        placeholder="High Priority"
                      />
                      <DynamicDatePicker 
                        placeholder="Start Date"
                        value={formData.endDate}
                        onDateChange={handleDateChange}
                      />
                      <DynamicDatePicker 
                        placeholder="End Date"
                        value={formData.endDate}
                        onDateChange={handleDateChange}
                      />
                    </div>
             
                    <Row>
                      
                      <Col md={6}>
                        <DynamicSelect
                          options={assignto}
                          value={formData.assignedDepartment}
                          onChange={(selectedOption) =>
                            handleInputChange("assignedDepartment", selectedOption)
                          }
                          inname="AssignedTo"
                          placeholder="Assigned To"
                        />
                      </Col>
                      <Col md={6}>
                        <DynamicSelect
                          options={areaOptions}
                          value={formData.assignedDepartment}
                          onChange={(selectedOption) =>
                            handleInputChange("assignedDepartment", selectedOption)
                          }
                          inname="AssignedDepartment"
                          placeholder="Assigned Department"
                        />
                      </Col>
                    </Row>

                  </div>

















                </Form>










              </div>
              

            </Tab>


            <Tab eventKey="createappoint" title="Create Appointment">
              Tab content for Profile
            </Tab>
            
          </Tabs>




        <Form>
          

          {/* Timing and Priority Section */}
          <div className="form-section">
            <h6 className="section-title">Timing and Priority</h6>
            <Row>
              {/* <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Priority</Form.Label>
                  <Form.Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                  >
                    {priorities.map(priority => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col> */}
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Date</Form.Label>
                  <div className="date-input-wrapper">
                    <Form.Control
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>End Date</Form.Label>
                  <div className="date-input-wrapper">
                    <Form.Control
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>
    
          </div>

          {/* Appointment Based Task Section */}
          <div className="form-section">
            <h6 className="section-title">Appointment based Task</h6>
            <ToggleButtonGroup
              type="radio"
              name="isAppointmentBased"
              value={formData.isAppointmentBased}
              onChange={(value) => handleInputChange('isAppointmentBased', value)}
              className="toggle-group"
            >
              <ToggleButton value="No" variant="outline-primary">No</ToggleButton>
              <ToggleButton value="Yes" variant="outline-primary">Yes</ToggleButton>
            </ToggleButtonGroup>
          </div>

          {/* Patient Detail Section - Show only if appointment based */}
          {formData.isAppointmentBased === 'Yes' && (
            <div className="form-section">
              <h6 className="section-title">Patient Detail</h6>
              <div className="search-wrapper mb-3">
                <div className="search-input">
                  <FaSearch className="search-icon" />
                  <Form.Control
                    type="text"
                    placeholder="Search Pet name/Parent Name"
                  />
                </div>
              </div>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Patient Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.patientName}
                      onChange={(e) => handleInputChange('patientName', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Parent Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.parentName}
                      onChange={(e) => handleInputChange('parentName', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Appointment Id</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.appointmentId}
                      onChange={(e) => handleInputChange('appointmentId', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Task Status</Form.Label>
                <Form.Select
                  value={formData.taskStatus}
                  onChange={(e) => handleInputChange('taskStatus', e.target.value)}
                >
                  {taskStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          )}

          {/* File Upload Section */}
          <div className="form-section">
            <h6 className="section-title">Upload File, Document, Image</h6>
            <div className="upload-area">
              <FaCloudUploadAlt className="upload-icon" />
              <p className="upload-text">Only PNG, JPEG, PDF, Word formats with max size 20 MB</p>
            </div>
          </div>
        </Form>
      </Modal.Body>

      <Modal.Footer className="modal-footer">
        <Button variant="primary" onClick={handleSubmit} className="create-btn">
          {mode === 'create' ? 'Create Task' : 'Update Task'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TaskModal;
