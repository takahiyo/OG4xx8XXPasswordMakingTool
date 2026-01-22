# [Before]
# (なし)

# [After]
DROP TABLE IF EXISTS request_logs;
CREATE TABLE request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  mac TEXT,
  password TEXT,
  via TEXT
);
