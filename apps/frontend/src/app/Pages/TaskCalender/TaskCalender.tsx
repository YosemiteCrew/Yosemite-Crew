'use client';
import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Dropdown } from 'react-bootstrap';
import Calendar from 'react-calendar';
import { FaChevronDown, FaChevronLeft, FaChevronRight, FaUser, FaPlus } from 'react-icons/fa';
import './TaskCalender.css';
import TaskModal from '@/app/Components/TaskModal/TaskModal';
import { Icon } from '@iconify/react/dist/iconify.js';
import Image from 'next/image';

interface Appointment {
  id: string;
  patientName: string;
  petName: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  date: Date;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

const TaskCalendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2025, 4, 3)); // May 3, 2025
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [selectedDoctor, setSelectedDoctor] = useState<TeamMember>({
    id: '1',
    name: 'Dr. James Wilson',
    role: 'Internal Medicine'
  });
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  
  // Dropdown states
  const [showAppointmentsDropdown, setShowAppointmentsDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('Internal Medicine');

  // Sample team members
  const teamMembers: TeamMember[] = [
    { id: '1', name: 'Dr. James Wilson', role: 'Internal Medicine' },
    { id: '2', name: 'Dr. Laura Evans', role: 'Internal Medicine' },
    { id: '3', name: 'Dr. Emily Foster', role: 'Internal Medicine' },
    { id: '4', name: 'Dr. Sarah Thompson', role: 'Vet Technician' },
    { id: '5', name: 'Robert Anderson', role: 'Assistant' },
    { id: '6', name: 'Jessica Collins', role: 'Nurse' }
  ];

  // Sample appointments
  const appointments: Appointment[] = [
    {
      id: '1',
      patientName: 'Sarah Williams',
      petName: 'Max',
      doctorName: 'Dr. James Wilson',
      startTime: '09:00',
      endTime: '09:30',
      date: new Date(2025, 4, 3)
    },
    {
      id: '2',
      patientName: 'Olivia Martinez',
      petName: 'Rocky',
      doctorName: 'Dr. James Wilson',
      startTime: '09:30',
      endTime: '10:00',
      date: new Date(2025, 4, 3)
    },
    {
      id: '3',
      patientName: 'John Carter',
      petName: 'Bella',
      doctorName: 'Dr. James Wilson',
      startTime: '11:00',
      endTime: '11:30',
      date: new Date(2025, 4, 3)
    },
    {
      id: '4',
      patientName: 'Isabella Wilson',
      petName: 'Buddy',
      doctorName: 'Dr. James Wilson',
      startTime: '12:30',
      endTime: '13:00',
      date: new Date(2025, 4, 3)
    },
    {
      id: '5',
      patientName: 'James Rodriguez',
      petName: 'Chloe',
      doctorName: 'Dr. James Wilson',
      startTime: '14:00',
      endTime: '14:30',
      date: new Date(2025, 4, 3)
    }
  ];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ];

  const specialties = ['Internal Medicine', 'Surgery', 'Emergency', 'Dermatology'];

  // Modal handlers
  const handleCreateTask = (date: Date, time: string) => {
    setModalMode('create');
    setSelectedTask(null);
    setSelectedTimeSlot(time);
    setShowModal(true);
  };

  const handleEditTask = (appointment: Appointment) => {
    setModalMode('edit');
    setSelectedTask(appointment);
    setSelectedTimeSlot(appointment.startTime);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedTask(null);
    setSelectedTimeSlot('');
  };

  // Date navigation functions
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'week') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Mini calendar navigation
  const navigateMiniCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const getWeekDates = (date: Date): Date[] => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const newDate = new Date(start);
      newDate.setDate(start.getDate() + i);
      dates.push(newDate);
    }
    return dates;
  };

  const getAppointmentsForTimeSlot = (time: string, date: Date) => {
    return appointments.filter(apt => 
      apt.startTime === time && 
      apt.date.toDateString() === date.toDateString()
    );
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatDayHeader = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      day: '2-digit' 
    });
  };

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const weekDates = getWeekDates(selectedDate);

  return (
    <>
      <section className="TaskCalenderSec">
        <Container>
            <div className="TaskCalenderData">

                <div className="LeftCalender">

                  <div className="clnderHead">
                    <h2>Calendar</h2>
                  </div>
                  <div className="SideCalenderItems">

                    {/* Appointments Filter */}
              <div className="filter-section">
                <div 
                  className="filter-header"
                  onClick={() => setShowAppointmentsDropdown(!showAppointmentsDropdown)}
                >
                  <span>Appointments</span>
                  <FaChevronDown className={`dropdown-icon ${showAppointmentsDropdown ? 'rotated' : ''}`} />
                </div>
                
                {showAppointmentsDropdown && (
                  <div className="filter-dropdown">
                    <Dropdown>
                      <Dropdown.Toggle variant="light" className="specialty-dropdown">
                        {selectedSpecialty}
                        <FaChevronDown className="dropdown-icon" />
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {specialties.map(specialty => (
                          <Dropdown.Item 
                            key={specialty}
                            onClick={() => setSelectedSpecialty(specialty)}
                          >
                            {specialty}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                )}

                <Card className="selected-doctor-card">
                  <Card.Body className="d-flex align-items-center">
                    <div className="doctor-avatar">
                      <FaUser />
                    </div>
                    <div className="doctor-info">
                      <div className="doctor-name">{selectedDoctor.name}</div>
                      <div className="doctor-role">{selectedDoctor.role}</div>
                    </div>
                  </Card.Body>
                </Card>

              </div>
                    
                    <div className="TopCalenderDate">

                      <div className="mini-calendar-section">

                        <div className="mini-calendar-header">
                          <Icon className='nav-icon' icon="lsicon:left-outline" width="18" height="18" onClick={() => navigateMiniCalendar('prev')} />
                          <span>{formatMonthYear(selectedDate)}</span>
                          <Icon className='nav-icon' icon="lsicon:right-outline" width="18" height="18" onClick={() => navigateMiniCalendar('next')} />
                        </div>

                        <Calendar
                          value={selectedDate}
                          onChange={(value) => setSelectedDate(value as Date)}
                          className="mini-calendar"
                          maxDetail="month"
                          minDetail="month"
                        />

                      </div>



                    </div>

                    <div className="BottomTeamCalender">
                      {/* Practice Team */}
                      <div className="team-section">
                        <div className="Teamfilter-header" onClick={() => setShowTeamDropdown(!showTeamDropdown)}>
                          <span>Practice Team</span>
                          <FaChevronDown className={`dropdown-icon ${showTeamDropdown ? 'rotated' : ''}`} />
                        </div>
                        
                        {showTeamDropdown && (
                          <div className="team-members">
                            {teamMembers.map(member => (
                              <Card 
                                key={member.id} 
                                className={`team-member-card ${selectedDoctor.id === member.id ? 'selected' : ''}`}
                                onClick={() => setSelectedDoctor(member)}
                              >
                                <Card.Body className="TeamCardDiv">
                                  <div className="member-avatar">
                                    <Image src="/Images/Explr3.jpg" alt='dr' width={40} height={40}/>
                                  </div>
                                  <div className="member-info">
                                    <h6 className="member-name">{member.name}</h6>
                                    <p className="member-role">{member.role}</p>
                                  </div>
                                </Card.Body>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                  </div>



                </div>

                <div className="RightCalender">

                  <div className="calendar-header">
                      <div className="view-controls">
                        <Button variant={viewMode === 'day' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('day')}className="view-btn"> Day </Button>
                        <Button variant={viewMode === 'week' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('week')} className="view-btn"> Week </Button>
                    </div>
                  </div>

                  {/* Date Navigation */}
                  <div className="date-navigation">
                    <FaChevronLeft 
                      className="nav-icon" 
                      onClick={() => navigateDate('prev')}
                    />
                    <span className="current-date">{formatDate(selectedDate)}</span>
                    <FaChevronRight 
                      className="nav-icon" 
                      onClick={() => navigateDate('next')}
                    />
                  </div>


                  {/* Calendar Grid */}
                  <div className="calendar-grid">
                    {/* Time slots column */}
                    <div className="time-slots-column">
                      <div className="time-slot-header"></div>
                      {timeSlots.map(time => (
                        <div key={time} className="time-slot">
                          {time}
                        </div>
                      ))}
                    </div>

                    {/* Days columns */}
                    {viewMode === 'week' ? (
                      weekDates.map((date, index) => (
                        <div key={index} className="day-column">
                          <div className="day-header">
                            {formatDayHeader(date)}
                          </div>
                          {timeSlots.map(time => {
                            const appointmentsForSlot = getAppointmentsForTimeSlot(time, date);
                            return (
                              <div 
                                key={time} 
                                className="time-slot-cell"
                                onClick={() => handleCreateTask(date, time)}
                              >
                                {appointmentsForSlot.map(appointment => (
                                  <div 
                                    key={appointment.id} 
                                    className="appointment-block"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditTask(appointment);
                                    }}
                                  >
                                    <div className="appointment-patient">
                                      {appointment.patientName} - {appointment.petName}
                                    </div>
                                    <div className="appointment-doctor">
                                      {appointment.doctorName}
                                    </div>
                                  </div>
                                ))}
                                {appointmentsForSlot.length === 0 && (
                                  <div className="empty-slot">
                                    <FaPlus className="add-icon" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))
                    ) : (
                      // Day view - show only selected date
                      <div className="day-column">
                        <div className="day-header">
                          {formatDayHeader(selectedDate)}
                        </div>
                        {timeSlots.map(time => {
                          const appointmentsForSlot = getAppointmentsForTimeSlot(time, selectedDate);
                          return (
                            <div 
                              key={time} 
                              className="time-slot-cell"
                              onClick={() => handleCreateTask(selectedDate, time)}
                            >
                              {appointmentsForSlot.map(appointment => (
                                <div 
                                  key={appointment.id} 
                                  className="appointment-block"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditTask(appointment);
                                  }}
                                >
                                  <div className="appointment-patient">
                                    {appointment.patientName} - {appointment.petName}
                                  </div>
                                  <div className="appointment-doctor">
                                    {appointment.doctorName}
                                  </div>
                                </div>
                              ))}
                              {appointmentsForSlot.length === 0 && (
                                <div className="empty-slot">
                                  <FaPlus className="add-icon" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Current time indicator */}
                  <div className="current-time-indicator"></div>
                  </div>

                  



                </div>


























            </div>

        
        </Container>
      </section>

      {/* Task Modal */}
      <TaskModal
        show={showModal}
        onHide={handleModalClose}
        mode={modalMode}
        taskData={selectedTask}
        selectedDate={selectedDate}
        selectedTime={selectedTimeSlot}
      />
    </>
  );
};

export default TaskCalendar;
