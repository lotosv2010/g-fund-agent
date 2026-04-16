/** 基础业务错误，所有自定义错误的父类 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 配置错误：环境变量缺失或格式错误 */
export class ConfigError extends AppError {}

/** MCP 连接错误：MCP 服务连接失败或工具获取失败 */
export class McpConnectionError extends AppError {}
