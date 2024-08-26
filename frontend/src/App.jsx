import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import { Layout, Menu, Input } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  DollarOutlined,
  FundOutlined,
  LineChartOutlined
} from "@ant-design/icons";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
import Clients from "./components/Clients";
import Funds from "./components/Funds";
import './App.css';

const { Header, Sider, Content } = Layout;
const { Search } = Input;

function App() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={200} className="site-layout-background">
          <div className="logo" />
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item key="1" icon={<DashboardOutlined />}>
              <Link to="/">Dashboard</Link>
            </Menu.Item>
            <Menu.Item key="2" icon={<DollarOutlined />}>
              <Link to="/sales">Sales</Link>
            </Menu.Item>
            <Menu.Item key="3" icon={<TeamOutlined />}>
              <Link to="/clients">Clients</Link>
            </Menu.Item>
            <Menu.Item key="4" icon={<FundOutlined />}>
              <Link to="/funds">Funds</Link>
            </Menu.Item>
            <Menu.Item key="5" icon={<LineChartOutlined />}>
              <Link to="/forecast">Forecast</Link>
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout className="site-layout">
          <Header className="site-layout-background" style={{ padding: 0 }}>
            <Search
              placeholder="Search..."
              onSearch={handleSearch}
              style={{ width: 200, margin: '16px 24px' }}
            />
          </Header>
          <Content
            className="site-layout-background"
            style={{
              margin: '24px 16px',
              padding: 24,
              minHeight: 280,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard searchTerm={searchTerm} />} />
              <Route path="/sales" element={<Sales searchTerm={searchTerm} />} />
              <Route path="/clients" element={<Clients searchTerm={searchTerm} />} />
              <Route path="/funds" element={<Funds searchTerm={searchTerm} />} />
              <Route path="/forecast" element={<h1>Forecast Page</h1>} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;