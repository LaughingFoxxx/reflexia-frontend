// AccountPage.jsx
import React from 'react';
import {Card, Button, Typography, Space, message} from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import './AccountPage.css';
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const AccountPage = () => {
    // Пример email пользователя (в реальном приложении это будет из состояния или API)
    const userEmail = 'user@example.com';

    const navigate = useNavigate();

    // Функция выхода из аккаунта (заглушка, замените на реальную логику)
    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:8082/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                message.success('Вы успешно вышли из аккаунта');
                navigate('/login');
            } else {
                message.error('Ошибка при выходе из аккаунта');
                navigate('/login'); // Перенаправляем даже при ошибке
            }
        } catch (error) {
            console.error('Logout error:', error);
            message.error('Ошибка при выходе из аккаунта');
            navigate('/login');
        }
    };

    return (
        <div className="account-page-container">
            <Title level={2} style={{ marginBottom: '24px' }}>Аккаунт</Title>

            <Card
                title={<Title level={4} style={{ margin: 0 }}>Информация об аккаунте</Title>}
                style={{ maxWidth: '400px', width: '100%' }}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                        <Text type="secondary">Email</Text>
                        <br />
                        <Text strong>{userEmail}</Text>
                    </div>
                    <Button
                        type="primary"
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                        block
                        className="logout-button"
                    >
                        Выйти из аккаунта
                    </Button>
                </Space>
            </Card>
        </div>
    );
};

export default AccountPage;