"use client";
import React, { useState, useMemo } from "react";

// Types
interface Appointment {
  id: string;
  title: string;
  doctor: string;
  patient: string;
  time: string;
  date: Date;
  isEmergency: boolean;
  status: "Requested" | "Upcoming" | "Checked-in" | "In progress" | "Completed";
}

type ViewType = "weekly" | "daily" | "person";
type FilterStatus = "all" | "emergency" | "Requested" | "Upcoming" | "Checked-in" | "In progress" | "Completed";

// Sample data
const generateAppointments = (): Appointment[] => {
  const doctors = ["Dr. Emily Johnson", "Dr. David Brown", "Dr. Megan Clark", "Dr. Sam Johnson"];
  const appointments: Appointment[] = [];
  const startDate = new Date(2026, 0, 5); // January 5, 2026
  const statusOptions: Appointment["status"][] = ["Requested", "Upcoming", "Checked-in", "In progress", "Completed"];

  // Generate 5 appointments per doctor (one for each status)
  doctors.forEach((doctor, docIdx) => {
    statusOptions.forEach((status, statusIdx) => {
      const appointmentIndex = docIdx * 5 + statusIdx;
      const hour = 9 + Math.floor(appointmentIndex / 4);
      const minute = (appointmentIndex % 4) * 15;
      const isEmergency = Math.random() > 0.6;

      appointments.push({
        id: `apt-${appointmentIndex}`,
        title: "Deworming Treatment",
        doctor: doctor,
        patient: "King Sky B",
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} AM`,
        date: startDate,
        isEmergency,
        status: status
      });
    });
  });

  return appointments;
};

const CalendarComponent: React.FC = () => {
  const [view, setView] = useState<ViewType>("weekly");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 0, 5));
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [appointments] = useState<Appointment[]>(generateAppointments());

  const doctors = useMemo(() =>
    Array.from(new Set(appointments.map(a => a.doctor))),
    [appointments]
  );

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let i = 9; i <= 10; i++) {
      slots.push(`${i.toString().padStart(2, '0')}:00`);
      slots.push(`${i.toString().padStart(2, '0')}:15`);
      slots.push(`${i.toString().padStart(2, '0')}:30`);
      slots.push(`${i.toString().padStart(2, '0')}:45`);
    }
    return slots;
  }, []);

  const getFilterColor = (status: FilterStatus, isActive: boolean): string => {
    if (!isActive) {
      return "bg-gray-100 text-gray-700 border border-gray-300"; // default light style
    }

    const activeColors: Record<FilterStatus, string> = {
      all: "bg-gray-600 text-white",
      emergency: "bg-red-500 text-white",
      Requested: "bg-gray-300 text-gray-700",
      Upcoming: "bg-blue-600 text-white",
      "Checked-in": "bg-orange-100 text-orange-500",
      "In progress": "bg-green-100 text-green-500",
      Completed: "bg-green-700 text-white",
    };

    return activeColors[status];
  };



  const getStatusColor = (status: FilterStatus): string => {
    const colors: Record<string, string> = {
      "all": "bg-gray-200 text-gray-700",
      "emergency": "bg-gray-200 text-gray-700",
      "Requested": "bg-gray-200 text-gray-700",
      "Upcoming": "bg-blue-500 text-white",
      "Checked-in": "bg-orange-100 text-orange-500",
      "In progress": "bg-green-100 text-green-500",
      "Completed": "bg-green-700 text-white"
    };
    return colors[status] || "bg-gray-200 text-gray-700";
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      // Filter by status
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "emergency" && apt.isEmergency) ||
        apt.status === filterStatus;

      // Filter by search query
      const matchesSearch = searchQuery === "" ||
        apt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.patient.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [appointments, filterStatus, searchQuery]);

  const AppointmentCard: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
    const statusColors: { [key: string]: string } = {
      "all": "bg-gray-200 text-gray-700",
      "emergency": "bg-gray-200 text-gray-700",
      "Requested": "bg-gray-200 text-gray-700",
      "Upcoming": "bg-blue-500 text-white",
      "Checked-in": "bg-orange-100 text-orange-500",
      "In progress": "bg-green-100 text-green-500",
      "Completed": "bg-green-700 text-white"
    };
    const statusColor = statusColors[appointment.status] || "bg-gray-200 text-gray-700";

    return (
      <div className={`${statusColor} rounded-2xl p-4 shadow-sm relative min-h-[140px]`}>
        {appointment.isEmergency && (
          <div className="absolute top-1 right-1 bg-red-200 text-red-500 text-xs px-2 py-1 rounded-full font-medium" style={{
            fontSize:10
          }}>
            Emergency
          </div>
        )}

        <div className="text-base font-semibold mb-2">{appointment.title}</div>

        <div className="flex items-center text-sm gap-1.5 mb-1.5">
          <span className="opacity-90">👤</span>
          <span className="opacity-90">{appointment.doctor}</span>
        </div>

        <div className="flex items-center text-sm gap-1.5 mb-3">
          <span className="opacity-90">🏢</span>
          <span className="opacity-90">{appointment.patient}</span>
        </div>

        <div className="text-sm font-medium">
          {appointment.time}
        </div>
      </div>
    );
  };

  const WeeklyView: React.FC = () => (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="flex gap-0 min-w-max">
        {/* Time column */}
        <div className="w-20 flex-shrink-0 bg-white">
          <div className="h-16 border-b border-gray-200"></div>
          {timeSlots.map((slot) => (
            <div key={slot} className="h-40 flex items-start justify-end pr-3 pt-2 text-sm text-gray-500 border-b border-gray-100">
              {slot}
            </div>
          ))}
        </div>

        {/* Doctors columns */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor, doctorIndex) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200 bg-white">
              {/* Doctor header */}
              <div className="h-16 flex items-center justify-center border-b border-gray-200 px-4">
                <span className={`text-base font-medium ${doctorIndex === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {doctor}
                </span>
              </div>

              {/* Time slots */}
              <div className="relative">
                {timeSlots.map((slot) => (
                  <div key={slot} className="h-40 border-b border-gray-100"></div>
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 p-3 space-y-3 overflow-y-auto">
                  {filteredAppointments
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
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="flex gap-0 min-w-max">
        {/* Time column */}
        <div className="w-20 flex-shrink-0 bg-white">
          <div className="h-24 border-b border-gray-200 flex items-center justify-center">
            <span className="text-lg font-medium">Mon 05</span>
          </div>
          {timeSlots.map((slot) => (
            <div key={slot} className="h-52 flex items-start justify-end pr-3 pt-2 text-sm text-gray-500 border-b border-gray-100">
              {slot}
            </div>
          ))}
        </div>

        {/* Doctors columns */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200 bg-white">
              {/* Doctor header */}
              <div className="h-24 flex items-center justify-center border-b border-gray-200 px-4">
                <span className="text-base font-medium text-gray-900">
                  {doctor}
                </span>
              </div>

              {/* Time slots */}
              <div className="relative">
                {timeSlots.map((slot) => (
                  <div key={slot} className="h-52 border-b border-gray-100"></div>
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 p-3 space-y-3 overflow-y-auto">
                  {filteredAppointments
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
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="flex gap-0 min-w-max">
        {/* Time column */}
        <div className="w-20 flex-shrink-0 bg-white">
          <div className="h-16 border-b border-gray-200"></div>
          {timeSlots.map((slot) => (
            <div key={slot} className="h-40 flex items-start justify-end pr-3 pt-2 text-sm text-gray-500 border-b border-gray-100">
              {slot}
            </div>
          ))}
        </div>

        {/* Doctors columns */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200 bg-white">
              {/* Doctor header */}
              <div className="h-16 flex items-center justify-center border-b border-gray-200 px-4">
                <span className="text-base font-medium text-gray-900">
                  {doctor}
                </span>
              </div>

              {/* Time slots */}
              <div className="relative">
                {timeSlots.map((slot) => (
                  <div key={slot} className="h-40 border-b border-gray-100"></div>
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 p-3 space-y-3 overflow-y-auto">
                  {filteredAppointments
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
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h1 className="text-4xl font-semibold">Appointments</h1>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2">
            <span>➕</span>
            Add
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`p-2.5 rounded-lg ${view === 'weekly' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            <span className="text-lg">📅</span>
          </button>

          <button
            onClick={() => setView("daily")}
            className={`p-2.5 rounded-lg ${view === 'daily' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            <span className="text-lg">🗂️</span>
          </button>

          <button
            onClick={() => setView("person")}
            className={`p-2.5 rounded-lg ${view === 'person' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            <span className="text-lg">👤</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-4 py-2 border ${filterStatus === 'all' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
          style={{ borderRadius: 5 }}
        >
          All
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "emergency" ? "all" : "emergency")}
          className={`px-4 py-2 border ${filterStatus === 'emergency' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
          style={{ borderRadius: 5 }}
        >
          Emergency
        </button>
        <div className="relative w-64">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2" style={{ marginLeft: "auto" }}>
          {(["Requested", "Upcoming", "Checked-in", "In progress", "Completed"] as const).map(status => (
            <button
              key={status}
              onClick={() =>
                setFilterStatus(filterStatus === status ? "all" : status)
              }
              className={`px-3 py-2 border text-xs font-medium ${filterStatus === status ? getStatusColor(status) : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
              style={{ borderRadius: 5, fontSize: 12 }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex justify-between items-center py-4 px-6 border-b">
        <button className="text-gray-400 text-2xl hover:text-gray-600">‹</button>

        <div className="text-center">
          <h2 className="text-xl font-normal text-gray-900">January 2026</h2>
          {view === "daily" && <p className="text-sm text-gray-500 mt-1">Mon 05</p>}
        </div>

        <button className="text-gray-400 text-2xl hover:text-gray-600">›</button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {view === "weekly" && <WeeklyView />}
        {view === "daily" && <DailyView />}
        {view === "person" && <PersonView />}
      </div>
    </div>
  );
};

export default CalendarComponent;