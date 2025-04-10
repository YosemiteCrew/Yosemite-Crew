class helpers {

static async calculateAge(date) {
    const dob = new Date(date);
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }  
static async capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();

  }

static async operationOutcome(status, severity, code, diagnostics) {
    return {
      resourceType: "OperationOutcome",
      issue: [
        {
          status,
          severity,
          code,
          diagnostics,
        },
      ],
    };
  }
static async convertTo24Hour(timeStr) {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");
    if (modifier === "PM" && hours !== "12") hours = parseInt(hours) + 12;
    if (modifier === "AM" && hours === "12") hours = "00";
    return `${hours}:${minutes}`;
  }
  
}
module.exports = helpers;