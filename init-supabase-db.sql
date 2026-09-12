-- Supabase PostgreSQL Database Initialization Script
-- Jalankan script ini di Supabase dashboard atau melalui baris perintah

-- Buat tabel untuk menyimpan riwayat chat
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    message JSONB NOT NULL, -- JSON format: {"role": "user"/"assistant", "content": "text"}
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Buat indeks untuk query cepat berdasarkan chat_id
CREATE INDEX IF NOT EXISTS idx_chat_history_chat_id ON chat_history(chat_id);

-- Buat indeks untuk query cepat berdasarkan timestamp
CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp);

-- Buat tabel untuk menyimpan statistik penggunaan keseluruhan
CREATE TABLE IF NOT EXISTS stats (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Buat tabel untuk melacak aktivitas pengguna per chat
CREATE TABLE IF NOT EXISTS user_activity (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Buat indeks untuk query cepat berdasarkan user_id
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);

-- Insert baris pertama untuk stats jika belum ada
INSERT INTO stats DEFAULT VALUES;

-- Grant permissions (sesuaikan username/role sesuai kebutuhan)
-- Misalnya:GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

-- Komentar untuk membantu pengguna
COMMENT ON TABLE chat_history IS 'Menyimpan riwayat percakapan per chat ID';
COMMENT ON TABLE stats IS 'Tabel sederhana untuk menghitung total pesan yang diproses';
COMMENT ON TABLE user_activity IS 'Melacak aktivitas pengguna per user ID';

-- Selesai - database siap digunakan!
SELECT 'Database initialization completed successfully';