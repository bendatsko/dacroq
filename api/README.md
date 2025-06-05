# Dacroq Data API

This is the **Data API** service that handles:
- Database operations
- User authentication  
- Test result storage
- System metrics
- Announcements

## Architecture

The Dacroq platform now uses a microservices architecture:

- **Data API** (this service): Port 8001 - Database operations and authentication
- **Hardware API**: Port 8000 - Physical hardware control and communication
- **Frontend**: Routed through nginx proxy

## Hardware Operations

For hardware operations (device control, firmware, GPIO reset), see the dedicated Hardware API:
```
/var/www/dacroq/hardware/
```

## Usage

This Data API should be started on port 8001:
```bash
python3 app.py --port 8001
```

The nginx configuration routes `/api/data/*` requests to this service.
