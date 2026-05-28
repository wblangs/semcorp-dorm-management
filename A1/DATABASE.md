# 数据库设计

## Dorms
- id
- name
- type
- address
- leaseStartDate
- leaseEndDate
- roomCount
- bedCount
- maxCapacity
- status

## Rooms
- id
- dormId
- roomName
- roomType
- bedCount
- genderLimit
- status

## People
- id
- chineseName
- englishName
- department
- personType
- gender
- canDrive
- canBeDriver

## Stay
- personId
- visaType
- arrivalDate
- plannedLeaveDate
- maxStayDate
- riskLevel

## Allocation
- personId
- dormId
- roomId
- checkInDate
- checkOutDate
- status

## Vehicles
- id
- plateNumber
- seatCount
- status

## Drivers
- personId
- licenseExpireDate
- availableShift

## Dispatch
- vehicleId
- driverPersonId
- actualPassengerCount
- routeName
