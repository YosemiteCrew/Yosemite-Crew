"use client";
import React, { useState, useMemo, useCallback } from "react";
import AddAppointmentModal from "./AddAppointmentModal";

// Types
interface Appointment {
  id: string;
  title: string;
  doctor: string;
  patient: string;
  time: string; // "HH:MM AM/PM"
  date: Date;
  isEmergency: boolean;
  status: "Requested" | "Upcoming" | "Checked-in" | "In progress" | "Completed";
}

// New interface to hold calculated layout
interface AppointmentWithLayout extends Appointment {
  layout: {
    top: string;
    height: string;
    left: string;
    width: string;
    isColliding: boolean;
  };
}

type ViewType = "weekly" | "daily" | "person";
type FilterStatus = "all" | "emergency" | "Requested" | "Upcoming" | "Checked-in" | "in progress" | "Completed";

// Helper to convert minutes since midnight to HH:MM AM/PM format
const formatMinutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Sample data
const generateAppointments = (): Appointment[] => {
  const doctors = ["Dr. Emily Johnson", "Dr. David Brown", "Dr. Megan Clark", "Dr. Sam Johnson"];
  const appointments: Appointment[] = [];
  const startDate = new Date(2026, 0, 5); // January 5, 2026
  const statusOptions: Appointment["status"][] = ["Requested", "Upcoming", "Checked-in", "In progress", "Completed"];

  const START_MINUTES = 9 * 60; // 540 (9:00 AM)
  const END_MINUTES = 19 * 60;   // 1140 (7:00 PM)

  const allAvailableSlots: number[] = [];
  for (let min = START_MINUTES; min < END_MINUTES; min += 30) {
    allAvailableSlots.push(min);
  }

  const shuffledSlots = allAvailableSlots.sort(() => 0.5 - Math.random());

  let slotIndex = 0;

  doctors.forEach((doctor, docIdx) => {
    for (let i = 0; i < 4; i++) { // 4 appointments per doctor (16 total)
      const statusIdx = i % statusOptions.length;
      const status = statusOptions[statusIdx];

      const startMinutes = shuffledSlots[slotIndex % shuffledSlots.length];
      slotIndex++;

      let patientName = `Patient ${docIdx}-${i}`;
      if (doctor === "Dr. Emily Johnson" && i === 1) {
        patientName = "King Sky B";
      }

      const isEmergency = (doctor === "Dr. Emily Johnson" && i === 1) ? true : (Math.random() > 0.8);

      appointments.push({
        id: `apt-${docIdx}-${i}`,
        title: status === "Completed" ? "Routine Checkup" : "Deworming Treatment",
        doctor: doctor,
        patient: patientName,
        time: formatMinutesToTime(startMinutes),
        date: startDate,
        isEmergency,
        status: status
      });
    }
  });

  return appointments.filter(a => {
    const timeParts = a.time.match(/(\d+):(\d+)\s(AM|PM)/);
    if (!timeParts) return false;
    let hour = parseInt(timeParts[1]);
    const minute = parseInt(timeParts[2]);
    const ampm = timeParts[3];

    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    const totalMinutes = hour * 60 + minute;
    return totalMinutes >= 540 && totalMinutes < 1140;
  });
};

const getAppointmentPosition = (time: string, isDailyView: boolean) => {
  const startTimeMinutes = 9 * 60;

  const timeParts = time.match(/(\d+):(\d+)\s(AM|PM)/);
  if (!timeParts) return { top: 0, height: 40, startMinutes: 0, durationMinutes: 30 };

  let hour = parseInt(timeParts[1]);
  const minute = parseInt(timeParts[2]);
  const ampm = timeParts[3];

  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const totalMinutes = hour * 60 + minute;
  const minutesSinceStart = totalMinutes - startTimeMinutes;

  const pxPerMinute = isDailyView ? (52 / 15) : (40 / 15);
  const baseHeight = isDailyView ? 52 : 40;

  const appointmentDurationMinutes = 30;

  const top = minutesSinceStart * pxPerMinute;
  const height = appointmentDurationMinutes * pxPerMinute;

  const topAdjustment = top + 5;
  const heightAdjustment = height - 10;

  return {
    top: `${topAdjustment}px`,
    height: `${Math.max(baseHeight, heightAdjustment)}px`,
    startMinutes: totalMinutes,
    durationMinutes: appointmentDurationMinutes
  };
};

const CalendarComponent: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<ViewType>("weekly");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [appointments] = useState<Appointment[]>(generateAppointments());
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const doctors = useMemo(() =>
    Array.from(new Set(appointments.map(a => a.doctor))).sort(),
    [appointments]
  );

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let i = 9; i < 20; i++) {
      const hour = i % 12 || 12;
      const ampm = i >= 12 ? 'PM' : 'AM';
      slots.push(`${hour.toString().padStart(2, '0')}:00 ${ampm}`);
      slots.push(`${hour.toString().padStart(2, '0')}:15 ${ampm}`);
      slots.push(`${hour.toString().padStart(2, '0')}:30 ${ampm}`);
      slots.push(`${hour.toString().padStart(2, '0')}:45 ${ampm}`);
    }
    return slots.filter(slot => {
      const [time, ampm] = slot.split(' ');
      const [hour, minute] = time.split(':').map(Number);
      const militaryHour = (ampm === 'PM' && hour !== 12) ? hour + 12 : (ampm === 'AM' && hour === 12) ? 0 : hour;
      return militaryHour < 19;
    });
  }, []);

  const totalTimeSlots = timeSlots.length;
  const weeklyColumnHeight = totalTimeSlots * 40; // 1600px
  const dailyColumnHeight = totalTimeSlots * 52; // 2080px

  const getStatusColor = useCallback((status: FilterStatus): string => {
    const colors: Record<string, string> = {
      "Upcoming": "bg-blue-600",
      "Completed": "bg-green-700",
      "Requested": "bg-gray-300",
      "Checked-in": "bg-orange-100",
      "In progress": "bg-green-100",
    };
    return colors[status] || "bg-gray-200";
  }, []);

  const getTextColor = useCallback((status: string): string => {
    const darkBackgrounds = ["Upcoming", "Completed"];
    return darkBackgrounds.includes(status) ? 'text-white' : 'text-gray-900';
  }, []);


  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "emergency" && apt.isEmergency) ||
        apt.status === filterStatus;

      const matchesSearch = searchQuery === "" ||
        apt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.patient.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [appointments, filterStatus, searchQuery]);

  const getAppointmentLayouts = (appointmentsToLayout: Appointment[], currentView: ViewType): AppointmentWithLayout[] => {
    const isDailyView = currentView === 'daily';

    return appointmentsToLayout.map(apt => {
      const pos = getAppointmentPosition(apt.time, isDailyView);

      const calculatedLayout: AppointmentWithLayout['layout'] = {
        top: pos.top,
        height: pos.height,
        left: '0%',
        width: '100%',
        isColliding: false
      };

      return { ...apt, layout: calculatedLayout };
    });
  };

  const appointmentsWithLayout = useMemo(() =>
    getAppointmentLayouts(filteredAppointments, view),
    [filteredAppointments, view]
  );

  // Appointment Card Component for absolute positioning
  const AppointmentCard: React.FC<{ appointment: AppointmentWithLayout }> = ({ appointment }) => {
    const statusColor = getStatusColor(appointment.status);
    const textColor = getTextColor(appointment.status);
    const { top, height, left, width } = appointment.layout;

    return (
      <div
        className={`${statusColor} rounded-xl shadow-md absolute cursor-pointer hover:shadow-lg transition-shadow duration-150 border-2 ${appointment.isEmergency ? 'border-red-500' : 'border-transparent'}`}
        style={{
          top,
          // height, 
          left,
          width,
          zIndex: appointment.isEmergency ? 20 : 10
        }}
      >
        <div className={`p-3 h-full flex flex-col justify-between ${textColor}`}>
          {/* Top Row: Title and Emergency Tag */}
          <div className="flex justify-between items-start mb-1">
            <div className="text-sm font-semibold truncate">{appointment.title}</div>
            {appointment.isEmergency && (
              <div className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-medium ml-2 uppercase flex-shrink-0">
                Emergency
              </div>
            )}
          </div>

          {/* Doctor and Patient Icons/Names */}
          <div className="flex flex-col gap-1 text-sm flex-grow">
            {/* Doctor */}
            <div className="flex items-center gap-1.5 opacity-90">
              <span className="text-xs">👤</span>
              <span className="font-medium">{appointment.doctor}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm flex-grow">
            {/* Doctor */}
            <div className="flex items-center gap-1.5 opacity-90">
              <span className="text-xs">👤</span>
              <span className="font-medium">{appointment.patient}</span>
            </div>
          </div>

          {/* Time */}
          <div className="text-xs font-bold mt-1">
            {appointment.time}
          </div>
        </div>
      </div>
    );
  };

  // --- Views with Absolute Positioning ---

  const WeeklyView: React.FC = () => (
    // **FIX:** Changed the class to manage sticky header and grid scrolling correctly
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Doctor Headers - Non-scrolling row */}
      <div className="flex gap-0 flex-shrink-0">
        {/* Time column spacer */}
        <div className="w-20 flex-shrink-0 bg-white border-b border-gray-200 h-16"></div>
        {/* Doctor names grid */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="h-16 flex items-center justify-center border-l border-b border-gray-200 px-4 bg-white">
              <span className="text-base font-medium text-gray-900 truncate">
                {doctor.split(' ')[1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable Schedule Grid */}
      {/* **FIX:** Main scrolling element is this container */}
      <div className="flex-1 flex ">
        {/* Time Column - Sticky left, scrolling vertically with the schedule */}
        <div className="w-20 flex-shrink-0 bg-white sticky left-0 z-30">
          {timeSlots.filter((_, index) => index % 4 === 0).map((slot) => (
            <div
              key={slot}
              className="h-40 flex items-start justify-end pr-3 pt-2 text-sm text-gray-500 border-b border-gray-100"
            >
              {slot.split(':')[0]}
            </div>
          ))}
        </div>

        {/* Appointment Grid - Scrolls vertically with the time column */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200 bg-white">
              {/* Appointment Container - Height 1600px */}
              <div className="relative" style={{ minHeight: `${weeklyColumnHeight}px` }}>
                {/* Time slot lines */}
                {timeSlots.map((slot, index) => (
                  index < totalTimeSlots && (
                    <div
                      key={slot}
                      className={`absolute w-full border-b ${index % 4 === 0 ? 'border-gray-200' : 'border-dashed border-gray-100'}`}
                      style={{ top: `${(index + 1) * 40}px` }}
                    ></div>
                  )
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 px-1">
                  {appointmentsWithLayout
                    .filter(a => a.doctor === doctor)
                    .map((a) => (
                      <AppointmentCard key={a.id} appointment={a} />
                    ))
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const DailyView: React.FC = () => (
    // **FIX:** Adjusted structure for scrolling
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Doctor Headers - Non-scrolling row */}
      <div className="flex gap-0 flex-shrink-0">
        {/* Time column spacer */}
        <div className="w-20 flex-shrink-0 bg-white border-b border-gray-200 h-24 flex items-center justify-center">
          <span className="text-lg font-medium">Mon 05</span>
        </div>
        {/* Doctor names grid */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="h-24 flex items-center justify-center border-l border-b border-gray-200 px-4 bg-white">
              <span className="text-base font-medium text-gray-900">
                {doctor}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable Schedule Grid */}
      <div className="flex-1 flex overflow-y-scroll">
        {/* Time Column - Sticky left */}
        <div className="w-20 flex-shrink-0 bg-white sticky left-0 z-30">
          {timeSlots.filter((_, index) => index % 4 === 0).map((slot) => (
            <div
              key={slot}
              className="h-52 flex items-start justify-end pr-3 pt-2 text-sm text-gray-500 border-b border-gray-100"
            >
              {slot.split(':')[0]}
            </div>
          ))}
        </div>

        {/* Appointment Grid */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200 bg-white">
              {/* Appointment Container - Height 2080px */}
              <div className="relative" style={{ minHeight: `${dailyColumnHeight}px` }}>
                {/* Time slot lines */}
                {timeSlots.map((slot, index) => (
                  index < totalTimeSlots && (
                    <div
                      key={slot}
                      className={`absolute w-full border-b ${index % 4 === 0 ? 'border-gray-200' : 'border-dashed border-gray-100'}`}
                      style={{ top: `${(index + 1) * 52}px` }}
                    ></div>
                  )
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 px-1">
                  {appointmentsWithLayout
                    .filter(a => a.doctor === doctor)
                    .map((a) => (
                      <AppointmentCard key={a.id} appointment={a} />
                    ))
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const PersonView: React.FC = () => (
    // **FIX:** Adjusted structure for scrolling
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Doctor Headers - Non-scrolling row */}
      <div className="flex gap-0 flex-shrink-0">
        {/* Time column spacer */}
        <div className="w-20 flex-shrink-0 bg-white border-b border-gray-200 h-16"></div>
        {/* Doctor names grid */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="h-16 flex items-center justify-center border-l border-b border-gray-200 px-4 bg-white">
              <span className="text-base font-medium text-gray-900 truncate">
                {doctor}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable Schedule Grid */}
      <div className="flex-1 flex overflow-y-scroll">
        {/* Time Column - Sticky left */}
        <div className="w-20 flex-shrink-0 bg-white sticky left-0 z-30">
          {timeSlots.filter((_, index) => index % 4 === 0).map((slot) => (
            <div
              key={slot}
              className="h-40 flex items-start justify-end pr-3 pt-2 text-sm text-gray-500 border-b border-gray-100"
            >
              {slot.split(':')[0]}
            </div>
          ))}
        </div>

        {/* Appointment Grid */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200 bg-white">
              {/* Appointment Container - Height 1600px */}
              <div className="relative" style={{ minHeight: `${weeklyColumnHeight}px` }}>
                {/* Time slot lines */}
                {timeSlots.map((slot, index) => (
                  index < totalTimeSlots && (
                    <div
                      key={slot}
                      className={`absolute w-full border-b ${index % 4 === 0 ? 'border-gray-200' : 'border-dashed border-gray-100'}`}
                      style={{ top: `${(index + 1) * 40}px` }}
                    ></div>
                  )
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 px-1">
                  {appointmentsWithLayout
                    .filter(a => a.doctor === doctor)
                    .map((a) => (
                      <AppointmentCard key={a.id} appointment={a} />
                    ))
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
        <h1 className="text-4xl font-semibold">Appointments</h1>
        <div className="flex items-center gap-3">
          {/* Add Button: Highly rounded, no icon, dark theme */}
          <button onClick={openModal} style={{ padding: 5, paddingLeft: 20, paddingRight: 20, borderRadius: 5 }} className="px-6 py-2.5 bg-gray-800 text-white rounded-full hover:bg-gray-700 font-medium">
            Add
          </button>

          {/* View Switchers: Grouped and styled to match the monochrome/active theme */}
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {/* Weekly View (Calendar +) */}
            <button
              onClick={() => setView("weekly")}
              className={`p-2.5 text-lg transition-colors ${view === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-100'}`
              }
            >
              <span className="text-base">&#x1F4C5;</span> {/* Calendar icon */}
            </button>

            {/* Daily View (Calendar dot) */}
            <button
              onClick={() => setView("daily")}
              className={`p-2.5 text-lg transition-colors border-l border-r border-gray-300 ${view === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-100'}`
              }
            >
              <span className="text-base">&#x1F4C6;</span> {/* Day/Event icon */}
            </button>

            {/* Person View (User icon) - Active state matches image */}
            <button
              onClick={() => setView("person")}
              className={`p-2.5 text-lg transition-colors ${view === 'person'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-100'}`
              }
            >
              <span className="text-base">👤</span> {/* Person icon */}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-4 border-b flex-wrap flex-shrink-0">
        <button
          style={{ fontSize: 12, borderRadius: 5 }}
          onClick={() => setFilterStatus("all")}
          className={`px-4 py-2 border rounded-xl ${filterStatus === 'all' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          All
        </button>
        <button
          style={{ fontSize: 12, borderRadius: 5 }}
          onClick={() => setFilterStatus(filterStatus === "emergency" ? "all" : "emergency")}
          className={`px-4 py-2 border rounded-xl ${filterStatus === 'emergency' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          Emergency
        </button>
        <div className="relative w-64">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search (Title, Doctor, Patient)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 10, fontSize: 12 }}
            className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 ml-auto flex-wrap" style={{ marginLeft: "auto" }}>
          {(["Requested", "Upcoming", "Checked-in", "In progress", "Completed"] as const).map(status => (
            <button
              key={status}
              onClick={() =>
                setFilterStatus(filterStatus === status ? "all" : status)
              }
              className={`px-3 py-2 border text-xs font-medium rounded-xl ${filterStatus === status ? getStatusColor(status) : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
              style={{ fontSize: 12, borderRadius: 5 }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex justify-between items-center py-4 px-6 border-b flex-shrink-0">
        <button className="text-gray-400 text-2xl hover:text-gray-600">‹</button>

        <div className="text-center">
          <h2 className="text-xl font-normal text-gray-900">January 2026</h2>
          {(view === "daily" || view === "person") && <p className="text-sm text-gray-500 mt-1">Mon 05</p>}
          {view === "weekly" && <p className="text-sm text-gray-500 mt-1">Jan 05 - Jan 11</p>}
        </div>

        <button className="text-gray-400 text-2xl hover:text-gray-600">›</button>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {view === "weekly" && <WeeklyView />}
        {view === "daily" && <DailyView />}
        {view === "person" && <PersonView />}
      </div>
      <AddAppointmentModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
};

export default CalendarComponent;