currentl in my mobileAppYC, the whole task module is mocked and locally done, i want you to integrate it properly with my new made backend below are all the required apis,
the task module is large and complex first search the whole module understand its current implementation, then integrate the backend accordingly also check my tasks module requiremenets and implementations accross various screens, i have the redux and everything already but now remove the old mocks and integrate with the backend properly also check if the provided backend is enough and compatible or need to ask for some changes to the backend engineer to support my task module below are the apis, also i want you to integrate the real adding of the events in my google or apple calendar, give me all the steps i need to do which u cant do to integrate this calendar event adding , i already have other modules integrated in my app with backend [apiClient.ts](apps/mobileAppYC/src/shared/services/apiClient.ts) , so integrate properly no duplication, no lint or tsc errors, 

create task curl --location --globoff '{{local}}/v1/task/mobile' \
--header 'x-user-id: ojkRXiEE4HYsU9fmuzt9bFR3y6g1' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJraWQiOiJRa0NrTEl4TUdFNGRYU2g3VmVYaHFmeTdIWVlsM2FmcllaM1BzdTM2bVRNPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiIxM2Y0NzhmMi05MGUxLTcwNTgtYWRlMi05ZjE2NmFiYWRiODkiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LWNlbnRyYWwtMS5hbWF6b25hd3MuY29tXC9ldS1jZW50cmFsLTFfaHh6VENxNW9ZIiwiY29nbml0bzp1c2VybmFtZSI6IjEzZjQ3OGYyLTkwZTEtNzA1OC1hZGUyLTlmMTY2YWJhZGI4OSIsImdpdmVuX25hbWUiOiJIYXJzaGl0Iiwib3JpZ2luX2p0aSI6IjZhMTIzZmVjLWE5ODAtNDFiYy04ODMzLWRlNzg2YTRjOTE4MiIsImF1ZCI6IjJhYW9zdnJoaTJ1a2g2dW5sZTZnY240NmVuIiwiZXZlbnRfaWQiOiIzOTExYWM3Ni0wNDg0LTQ2YTItYjcwYi0wNTJmN2U4ODRjNWQiLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTc2NTYzMzc5NSwiZXhwIjoxNzY1NjM3Mzk1LCJjdXN0b206cm9sZSI6Im1lbWJlciIsImlhdCI6MTc2NTYzMzc5NSwiZmFtaWx5X25hbWUiOiJXYW5kaGFyZSIsImp0aSI6IjViNGY1MWIwLTQ2NzYtNDcxNy04ZjJhLWMxNDg1MzYzNzQ4YSIsImVtYWlsIjoiaGFyc2hpdEB5b3NlbWl0ZWNyZXcuY29tIn0.KUJwETXnuw2i-kIJk5uPYy00jQsLWa34_5CHxdzBMGfiXq5Y0X599MXKLmX83T2B_4qSmIe_5G9FouxYAkVFwLUZXywwLUQmWwwnZKj98G6oXtoV-Gqm3Yb2Xd1KoDhre2IHEzMCw7BefQCjJm8mYO1T3KXjanrHAgGRwJRU0jCpBaELUrGHXqgxAnPsSRMVILoC7W2Afh5yrMjEXKsiQmI4LSkewL-u93lBB46Eb3fZMpvS7GoC00n7rzjYFpGGiNdwsDOM3k6r4lrC00U2gWHAm1_Mx-FRyknSU5V3ZXB_LvIgrwHJTlOdUmm4NXSSdGImdzwj96iz77EzVvmwqw' \
--data '{
  "name": "Give heartworm medicine",
  "description": "Give medicine after dinner",
  "category": "MEDICATION",
  "audience": "PARENT_TASK",
  "companionId": "6929d4523f67725151b93f3a",
  
  "dueAt": "2025-01-10T18:00:00.000Z",
  "medication": {
    "name": "Heartgard",
    "doses": [
      { "dosage": "1 tablet", "time": "09:00" }
    ]
  },
  "recurrence": {
    "type": "ONCE"
  },
  "reminder": {
    "enabled": true,
    "offsetMinutes": 60
  }
}'
sample response :
{
    "companionId": "6929d4523f67725151b93f3a",
    "createdBy": "6929d4293f67725151b93f31",
    "assignedBy": "6929d4293f67725151b93f31",
    "assignedTo": "6929d4293f67725151b93f31",
    "audience": "PARENT_TASK",
    "source": "CUSTOM",
    "category": "MEDICATION",
    "name": "Give heartworm medicine",
    "description": "Give medicine after dinner",
    "medication": {
        "name": "Heartgard",
        "dosage": "1 tablet",
        "frequency": "ONCE"
    },
    "dueAt": "2025-01-10T18:00:00.000Z",
    "recurrence": {
        "type": "ONCE",
        "isMaster": false
    },
    "reminder": {
        "enabled": true,
        "offsetMinutes": 60
    },
    "syncWithCalendar": false,
    "attachments": [],
    "status": "PENDING",
    "_id": "69490cc18f8c860975d4c9ba",
    "createdAt": "2025-12-22T09:17:53.494Z",
    "updatedAt": "2025-12-22T09:17:53.494Z",
    "__v": 0
}

list tasks for parent which will be called in the [HomeScreen.tsx](apps/mobileAppYC/src/features/home/screens/HomeScreen/HomeScreen.tsx) just like we get appointments for the user 
curl --location --globoff '{{local}}/v1/task/mobile/task' \
--header 'x-user-id: ojkRXiEE4HYsU9fmuzt9bFR3y6g1'

below is the get task by id 
curl --location --globoff '{{local}}/v1/task/mobile/69490cc18f8c860975d4c9ba' \
--header 'x-user-id: ojkRXiEE4HYsU9fmuzt9bFR3y6g1'


update task 
curl --location --globoff --request PATCH '{{local}}/v1/task/mobile/69490cc18f8c860975d4c9ba' \
--header 'x-user-id: ojkRXiEE4HYsU9fmuzt9bFR3y6g1' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Give heartworm medicine (updated)",
  "description": "Give medicine after evening walk",
  "dueAt": "2025-01-10T19:00:00.000Z"
}'

get task for companion 
curl --location --globoff '{{local}}/v1/task/mobile/companion/6929d4523f67725151b93f3a'

change task status 
curl --location --globoff '{{local}}/v1/task/mobile/69490cc18f8c860975d4c9ba/status' \
--header 'x-user-id: ojkRXiEE4HYsU9fmuzt9bFR3y6g1' \
--header 'Content-Type: application/json' \
--data '{
  "status": "COMPLETED",
  "completion": {
    "notes": "Given after dinner",
    "completedAt": "2025-01-10T18:10:00.000Z"
  }
}'

, also since our task module also supports OTs , so now each Ot will be submitted via the below form apis, and then the booking flow would start but this time with the OT as the service, and we already have the current implemented appoinment booking and payment flow so merge it accordingly to reuse that,
