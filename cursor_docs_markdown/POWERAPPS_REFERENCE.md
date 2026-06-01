# Power Apps 参考

> Historical reference only. Drivers、TransportNeeds、Dispatch 相关表属于 Future Scope，不纳入当前 MVP。

## Excel 导入表
- tbl_Dorms
- tbl_Rooms
- tbl_People
- tbl_Stay
- tbl_Allocation
- tbl_Vehicles
- tbl_Drivers
- tbl_TransportNeeds
- tbl_Dispatch

## 联动下拉示例

### 房间联动
```powerfx
Filter(tbl_Rooms, 宿舍ID = dd_Dorm.Selected.宿舍ID)
```

### 未满房过滤
```powerfx
Filter(
    tbl_Rooms,
    宿舍ID = dd_Dorm.Selected.宿舍ID &&
    当前入住人数 < 床位数
)
```

## 推荐技术路线
Power Apps → Dataverse → Power Automate
