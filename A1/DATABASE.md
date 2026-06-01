# 数据库设计

> Historical reference only. Drivers/Dispatch/TransportNeeds 不属于当前 MVP，暂不开发。

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
