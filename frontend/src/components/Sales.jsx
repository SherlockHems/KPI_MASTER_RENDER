import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Row, Col, Spin, Alert, Select, Table, Radio } from 'antd';
import axios from 'axios';

const { Option } = Select;

function Sales({ searchTerm }) {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState(null);
  const [contributionType, setContributionType] = useState('cumulative');
  const [breakdownType, setBreakdownType] = useState('daily');

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/sales`);
      console.log("Sales API response:", response.data);

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setSalesData(response.data);
      if (response.data.salesPersons.length > 0) {
        setSelectedSalesPerson(response.data.salesPersons[0].name);
      }
    } catch (e) {
      console.error("获取销售数据错误:", e);
      setError(`错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="错误" description={error} type="error" showIcon />;
  if (!salesData || salesData.salesPersons.length === 0) return <Alert message="没有可用的销售数据" type="warning" showIcon />;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  const salesPersonColumns = [
    {
      title: '销售人员',
      dataIndex: 'name',
      key: 'name',
      filteredValue: [searchTerm],
      onFilter: (value, record) => record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: '客户总数',
      dataIndex: 'totalClients',
      key: 'totalClients',
      sorter: (a, b) => a.totalClients - b.totalClients,
    },
    {
      title: '总收入',
      dataIndex: 'cumulativeIncome',
      key: 'cumulativeIncome',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.cumulativeIncome - b.cumulativeIncome,
    }
  ];

  const cumulativeData = salesData.dailyContribution.reduce((acc, day) => {
    const prevDay = acc[acc.length - 1] || {};
    const newDay = { date: day.date };
    Object.keys(day).forEach(key => {
      if (key !== 'date') {
        newDay[key] = (prevDay[key] || 0) + day[key];
      }
    });
    acc.push(newDay);
    return acc;
  }, []);

  const prepareIndividualData = (data, dataKey) => {
    if (breakdownType === 'daily') {
      return data.map(day => ({
        date: day.date,
        ...Object.fromEntries(Object.entries(day[dataKey]).map(([k, v]) => [k, Math.max(0, v)]))
      }));
    } else {
      return data.reduce((acc, day) => {
        const newDay = { date: day.date };
        Object.keys(day[dataKey]).forEach(key => {
          newDay[key] = Math.max(0, (acc[acc.length - 1]?.[key] || 0) + day[dataKey][key]);
        });
        acc.push(newDay);
        return acc;
      }, []);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const sortedData = [...payload]
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      return (
        <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc' }}>
          <p>{`日期: ${new Date(label).toLocaleDateString()}`}</p>
          {sortedData.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderBreakdownChart = (data) => {
    const allKeys = Object.keys(data[0]).filter(key => key !== 'date');
    const maxValue = Math.max(...data.flatMap(day => Object.values(day).filter(val => typeof val === 'number')));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
          <YAxis
            tickFormatter={formatCurrency}
            domain={[0, maxValue]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {allKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const prepareDailyIncomeData = () => {
    return salesData.dailyContribution.map(day => {
      const formattedDay = {
        date: new Date(day.date).toLocaleDateString(),
      };
      salesData.salesPersons.forEach(person => {
        formattedDay[person.name] = formatCurrency(Math.max(0, day[person.name] || 0));
      });
      return formattedDay;
    });
  };

  const dailyIncomeColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    ...salesData.salesPersons.map(person => ({
      title: person.name,
      dataIndex: person.name,
      key: person.name,
    })),
  ];

  return (
    <div>
      <h1>销售仪表盘</h1>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="按销售人员累计收入贡献">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={salesData.salesPersons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="cumulativeIncome" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="销售人员业绩">
            <Table
              dataSource={salesData.salesPersons}
              columns={salesPersonColumns}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Card title="所有销售人员收入贡献" style={{ marginTop: 16 }}>
        <Radio.Group
          value={contributionType}
          onChange={(e) => setContributionType(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="cumulative">累计</Radio.Button>
          <Radio.Button value="daily">每日</Radio.Button>
        </Radio.Group>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={contributionType === 'cumulative' ? cumulativeData : salesData.dailyContribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />
            {salesData.salesPersons.map((person, index) => (
              <Line
                key={person.name}
                type="monotone"
                dataKey={person.name}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={contributionType === 'daily' ? { stroke: colors[index % colors.length], strokeWidth: 2, r: 4 } : false}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="个人销售业绩" style={{ marginTop: 16 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Select
              style={{ width: 200 }}
              value={selectedSalesPerson}
              onChange={setSelectedSalesPerson}
            >
              {salesData.salesPersons.map(person => (
                <Option key={person.name} value={person.name}>{person.name}</Option>
              ))}
            </Select>
          </Col>
          <Col span={12}>
            <Radio.Group
              value={breakdownType}
              onChange={(e) => setBreakdownType(e.target.value)}
            >
              <Radio.Button value="daily">每日</Radio.Button>
              <Radio.Button value="cumulative">累计</Radio.Button>
            </Radio.Group>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <h3>按客户细分</h3>
            {renderBreakdownChart(prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'clients'))}
          </Col>
          <Col span={12}>
            <h3>按基金细分</h3>
            {renderBreakdownChart(prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'funds'))}
          </Col>
        </Row>
      </Card>

      <Card title="按销售人员每日收入贡献" style={{ marginTop: 16 }}>
        <Table
          dataSource={prepareDailyIncomeData()}
          columns={dailyIncomeColumns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
}

export default Sales;