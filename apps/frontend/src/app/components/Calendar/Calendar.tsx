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
type FilterStatus = "all" | "Requested" | "Upcoming" | "Checked-in" | "In progress" | "Completed";

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

  const getStatusColor = (status: Appointment["status"] | "all"): string => {
    const colors: Record<Appointment["status"], string> = {
      "Requested": "bg-gray-200 text-gray-700",
      "Upcoming": "bg-blue-500 text-white",
      "Checked-in": "bg-orange-400 text-white",
      "In progress": "bg-green-600 text-white",
      "Completed": "bg-green-700 text-white"
    };
    if (status === "all") return "bg-gray-200";
    return colors[status] || "bg-gray-200";
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesStatus = filterStatus === "all" || apt.status === filterStatus;
      const matchesSearch = searchQuery === "" ||
        apt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.patient.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [appointments, filterStatus, searchQuery]);

  const AppointmentCard: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
    const statusColors: { [key: string]: string } = {
      Upcoming: "bg-[#2F6FED] text-white",
      "In progress": "bg-[#16A34A] text-white",
      Completed: "bg-[#16A34A] text-white",
      Requested: "bg-[#F5F5F5] text-gray-700",
      "Checked-in": "bg-[#FB923C] text-white"
    };
    const statusColor = statusColors[appointment.status] || "bg-gray-200 text-gray-700";

    return (
      <div className={`${statusColor} rounded-xl p-3 shadow-sm relative h-28`}>
        {appointment.isEmergency && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
            Emergency
          </div>
        )}
        
        <div className="text-sm font-semibold mb-1.5">{appointment.title}</div>

        <div className="flex items-center text-xs gap-1 mb-1">
          <span className="opacity-90">👤</span>
          <span className="opacity-90">{appointment.doctor}</span>
        </div>

        <div className="flex items-center text-xs gap-1 mb-1.5">
          <span className="opacity-90">🏢</span>
          <span className="opacity-90">{appointment.patient}</span>
        </div>

        <div className="text-xs font-medium">
          {appointment.time}
        </div>
      </div>
    );
  };

  const WeeklyView: React.FC = () => (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-0">
        {/* Time column */}
        <div className="w-16 flex-shrink-0">
          <div className="h-16"></div>
          {timeSlots.map((slot) => (
            <div key={slot} className="h-32 flex items-start justify-end pr-2 text-xs text-gray-400">
              {slot}
            </div>
          ))}
        </div>

        {/* Doctors columns */}
        <div className="flex-1 grid grid-cols-4 gap-0">
          {doctors.map((doctor, doctorIndex) => (
            <div key={doctor} className="flex flex-col border-l border-gray-200">
              {/* Doctor header */}
              <div className="h-16 flex items-center justify-center border-b border-gray-200">
                <span className={`text-sm font-medium ${doctorIndex === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {doctor}
                </span>
              </div>

              {/* Time slots */}
              <div className="relative">
                {timeSlots.map((slot) => (
                  <div key={slot} className="h-32 border-b border-gray-100"></div>
                ))}

                {/* Appointments */}
                <div className="absolute inset-0 p-2 space-y-2 overflow-y-auto">
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
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold mb-4">Monday, January 5, 2026</h3>
        {timeSlots.map(slot => {
          const slotAppointments = filteredAppointments.filter(apt => apt.time.startsWith(slot));
          return (
            <div key={slot} className="mb-6">
              <div className="text-sm font-medium text-gray-500 mb-2">{slot}</div>
              {slotAppointments.length > 0 ? (
                <div className="grid gap-2">
                  {slotAppointments.map(apt => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              ) : (
                <div className="text-gray-300 text-sm italic">No appointments</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const PersonView: React.FC = () => (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-2 gap-6">
        {doctors.map(doctor => (
          <div key={doctor}>
            <h3 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-gray-900">
              {doctor}
            </h3>
            <div className="space-y-2">
              {filteredAppointments
                .filter(apt => apt.doctor === doctor)
                .map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} />
                ))}
            </div>
          </div>
        ))}
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
          className={`px-4 py-2 rounded-full border ${filterStatus === 'all' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
        >
          All
        </button>
        <button className="px-4 py-2 rounded-full border border-blue-500 bg-blue-50 text-blue-600">
          Emergency
        </button>
        <div className="relative w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>


        <div className="flex gap-2 ml-auto">
          {(["Requested", "Upcoming", "Checked-in", "In progress", "Completed"] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${filterStatus === status ? getStatusColor(status) : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
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