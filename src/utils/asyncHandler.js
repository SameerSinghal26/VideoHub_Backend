const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}


export { asyncHandler }

// const asynHandler = () => {}
// const asynHandler = (func) => {() => {}}
// const asynHandler = (func) => async () => {}

// const asyncHandler = (fun) => async (req, res, next) => {
//     try {
//         await fun(req, res, next)
//     } catch (error) {
//         console.log(error.code || 500).json({
//             success : false,
//             message : error.message
//         })
        
//     }
// }