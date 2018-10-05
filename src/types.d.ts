import {DataTypeAbstract, DefineAttributeColumnOptions} from 'sequelize';

type SequelizeAttribute = string | DataTypeAbstract | DefineAttributeColumnOptions;

// This will allow to globally use "SequelizeAttribute" instead of always having to declare
// "string | DataTypeAbstract | DefineAttributeColumnOptions"
// See the schemas for usage examples.
declare global {
  type SequelizeAttributes<T extends { [key: string]: any }> = {
    [P in keyof T]: SequelizeAttribute
  };
}
