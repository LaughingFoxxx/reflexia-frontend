import React, { useState, useEffect, useRef } from 'react';
import {Card, Button, Typography, Space, message, Spin} from 'antd';
import {LoadingOutlined, LogoutOutlined} from '@ant-design/icons';
import './AccountPage.css';
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const AccountPage = () => {
    const [userEmail, setUserEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const isFetching = useRef(false); // Prevents concurrent fetches

    const fetchUserEmail = async () => {
        if (isFetching.current) return; // Prevent multiple fetches
        isFetching.current = true;

        try {
            const response = await fetch('http://localhost:8082/api/text/get-user-email', {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                setUserEmail(data.email);
                setLoading(false);
            } else if (response.status === 401) {
                // Try to refresh token
                const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (refreshResponse.ok) {
                    // Retry original request after successful refresh
                    const retryResponse = await fetch('http://localhost:8082/api/text/get-user-email', {
                        method: 'GET',
                        credentials: 'include',
                    });

                    if (retryResponse.ok) {
                        const retryData = await retryResponse.json();
                        setUserEmail(retryData.email);
                        setLoading(false);
                    } else {
                        message.error('Не удалось получить данные пользователя');
                        navigate('/login');
                    }
                } else {
                    message.error('Сессия истекла, пожалуйста, войдите заново');
                    navigate('/login');
                }
            } else {
                message.error('Ошибка при получении данных пользователя');
                navigate('/login');
            }
        } catch (error) {
            console.error('Fetch email error:', error);
            message.error('Ошибка при получении данных пользователя');
            navigate('/login');
        } finally {
            isFetching.current = false;
        }
    };

    useEffect(() => {
        fetchUserEmail();
        // Empty dependency array ensures this runs only once on mount
    }, []);

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
                navigate('/login');
            }
        } catch (error) {
            console.error('Logout error:', error);
            message.error('Ошибка при выходе из аккаунта');
            navigate('/login');
        }
    };

    if (loading) {
        return <div><Spin className="spiner" indicator={<LoadingOutlined style={{ fontSize: 56 }} spin />}></Spin></div>
    }

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